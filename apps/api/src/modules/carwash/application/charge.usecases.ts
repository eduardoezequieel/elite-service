import { API_ERROR_CODES, PERMISSIONS } from '@elite/shared';
import type {
  CarwashEventActor,
  Charge,
  ChargeProductInput,
  CreateChargeInput,
  PriceAuthorizationInput,
  Ticket,
  VoidChargeInput,
} from '@elite/shared';

import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../common/errors/application-error';
import type { ActionAuthorizer } from '../../../common/auth/authenticated-user';
import {
  publishLowStock,
  type LowStockPublisher,
} from '../../inventory/application/ports/low-stock-events';
import { fromQuantityString } from '../../inventory/domain/stock';
import {
  needsPriceAuthorization,
  priceSaleLines,
  snapshotSaleLine,
  type PricedSaleLine,
  type SaleLineRejection,
  type SalePriceSignature,
} from '../../sales/domain/counter-sale';
import {
  allocateLines,
  hasTransferWithoutAccount,
  rejectChargeAccount,
  settleCash,
  sumCents,
  transferAccountIdsOf,
  type ChargeLine,
} from '../domain/charge';
import { commissionBaseOf, commissionFor, splitCommission } from '../domain/commission';
import { toCents, toDecimalString, type Cents } from '../domain/money';
import { signed } from './authorized-note';
import type { BankAccountDirectory } from './ports/bank-account-directory';
import { CashSessionGoneError, type CashSessionRepository } from './ports/cash-session.repository';
import {
  BankAccountUnavailableError,
  ChargeNotVoidableError,
  TicketsNotChargeableError,
  type ChargeRepository,
  type ChargeTicketData,
  type VoidChargeTarget,
} from './ports/charge.repository';
import type { InventoryCatalog } from './ports/inventory-catalog';
import type { PriceAuthorizer } from './ports/price-authorizer';
import type { TicketEventsPublisher } from './ports/ticket-events';
import type { TicketRepository } from './ports/ticket.repository';
import { publishTicketEvent } from './publish-ticket-event';
import { stockFailure } from './stock-failure';

/** Deshacer una cuenta: el motivo y quien lo firmo (045). */
export interface AccountVoidRequest {
  reason: string;
  /** `null` solo en llamadas internas sin firma (los tests). */
  authorizer: ActionAuthorizer | null;
}

/** Lo que deshizo la anulacion: los lavados en `READY` y la venta en `VOID`. */
export interface VoidedAccount {
  tickets: Ticket[];
  counterSaleId: string | null;
}

/**
 * La cuenta de cobro (059, 066).
 *
 * **Todo cobro pasa por aca**, tenga un lavado, cinco, productos sueltos o las
 * dos cosas (RN-1). El endpoint viejo —un lavado, un pago— delega en `create`
 * con una cuenta de uno, y la venta suelta (`POST /sales`) con una cuenta sin
 * lavados: si hubiera dos caminos que escriben pagos, tarde o temprano uno
 * congelaria la comision distinto que el otro.
 *
 * La cuenta nace cobrada y muere entera (RN-2, RN-8): no se guarda a medio
 * pagar, y deshacer cualquier parte deshace los lavados y la venta juntos.
 */
export class ChargeUseCases {
  constructor(
    private readonly charges: ChargeRepository,
    private readonly tickets: TicketRepository,
    private readonly cashSessions: CashSessionRepository,
    private readonly events: TicketEventsPublisher,
    private readonly inventory: InventoryCatalog,
    private readonly authorizer: PriceAuthorizer,
    private readonly lowStock: LowStockPublisher,
    private readonly bankAccounts: BankAccountDirectory,
  ) {}

  async findById(id: string): Promise<Charge> {
    const charge = await this.charges.findById(id);

    if (charge === null) {
      throw new NotFoundError({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese cobro no existe.',
      });
    }

    return charge;
  }

  /**
   * Cobra una cuenta: lavados a `PAID`, comisiones congeladas, la venta suelta
   * con su salida del kardex y pagos en el turno abierto, todo en una sola
   * transaccion (RN-7, 066). La venta es una parte mas del reparto (RN-5).
   */
  async create(
    input: CreateChargeInput,
    userId: string,
    actor: CarwashEventActor | null = null,
  ): Promise<Charge> {
    const products = input.products ?? [];

    if (input.workOrderIds.length === 0 && products.length === 0) {
      throw new ValidationError({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'La cuenta necesita al menos un lavado o un producto.',
      });
    }

    const tickets = await this.loadChargeable(input.workOrderIds);
    const saleLines = products.length === 0 ? [] : await this.priceProducts(products);
    const hasSale = saleLines.length > 0;
    const ticketTotals = tickets.map((ticket) => toCents(ticket.total));
    const saleTotal = sumCents(saleLines.map((line) => line.total));
    // Cada lavado y la venta son partes de la misma cuenta: la venta va al
    // final, y asi su renglon es siempre el ultimo del reparto.
    const buckets = hasSale ? [...ticketTotals, saleTotal] : ticketTotals;
    const lines: ChargeLine[] = input.payments.map((payment) => ({
      method: payment.method,
      amount: toCents(payment.amount),
      details: {
        bankAccountId: payment.bankAccountId ?? null,
        reference: payment.reference ?? null,
        description: payment.description ?? null,
      },
    }));
    const tendered = input.cashTendered === undefined ? null : toCents(input.cashTendered);
    const total = sumCents(buckets);

    this.rejectAccount(buckets, lines, tendered, total, hasSale);
    await this.assertBankAccounts(lines);

    const session = await this.cashSessions.findOpen();

    if (session === null) {
      throw new ConflictError({
        code: API_ERROR_CODES.CASH_NOT_OPEN,
        message: 'Abrí la caja para cobrar.',
      });
    }

    const signer = await this.signPrices(saleLines, input.priceAuthorization);
    const allocation = allocateLines(lines, buckets);
    const settlement = settleCash(lines, tendered);
    const customerName = input.customerName?.trim() ?? '';

    try {
      const { charge, lowStock } = await this.charges.create(
        {
          total,
          ...settlement,
          userId,
          cashSessionId: session.id,
          tickets: tickets.map((ticket, index) =>
            chargeTicketData(ticket, ticketTotals[index], allocation[index] ?? []),
          ),
          sale: hasSale
            ? {
                customerName: customerName === '' ? null : customerName,
                total: saleTotal,
                lines: saleLines.map((line) => snapshotSaleLine(line, signer)),
                payments: allocation[tickets.length] ?? [],
              }
            : null,
        },
        actor,
      );

      // Un evento por lavado (042): quien mira el tablero ve moverse los tres
      // carros de la cuenta, no una cuenta que no sabe leer.
      for (const charged of charge.tickets) {
        publishTicketEvent(this.events, {
          type: 'ticket.charged',
          ticket: charged,
          previousStatus: 'READY',
          actor,
        });
      }

      publishLowStock(this.lowStock, lowStock, actor);

      return charge;
    } catch (error) {
      throw this.chargeFailure(error);
    }
  }

  /** Deshace la cuenta entera: todos sus lavados vuelven a `READY` (RN-8). */
  async voidById(
    id: string,
    input: VoidChargeInput,
    actor: CarwashEventActor | null = null,
    authorizer: ActionAuthorizer | null = null,
  ): Promise<Ticket[]> {
    const voided = await this.voidAccount(id, { reason: input.reason, authorizer }, actor);

    return voided.tickets;
  }

  /**
   * Deshace la cuenta entera desde cualquiera de sus partes (RN-8, 066): los
   * lavados vuelven a `READY` —con sus productos puestos: el kardex no se
   * mueve— y la venta suelta queda `VOID` con sus productos de vuelta al
   * inventario. Una sola firma para todo.
   */
  async voidAccount(
    id: string,
    request: AccountVoidRequest,
    actor: CarwashEventActor | null = null,
  ): Promise<VoidedAccount> {
    await this.findById(id);

    return this.undo({ chargeId: id }, request, actor);
  }

  /**
   * Deshace el cobro de **un** lavado. Si su cuenta tiene mas de uno, no hay
   * media vuelta atras que dar: o se deshace completa o no se deshace (RN-8).
   * Si la cuenta lleva ademas productos sueltos, la venta se anula con el
   * (066): la cuenta nunca se deshace a medias.
   *
   * Un lavado cobrado antes de la 059 no tiene cuenta; ese se deshace solo,
   * como hasta ahora.
   */
  async voidForTicket(
    ticket: Ticket,
    reason: string,
    actor: CarwashEventActor | null = null,
    authorizer: ActionAuthorizer | null = null,
  ): Promise<Ticket[]> {
    const charge = ticket.charge;

    if (charge !== null && charge.ticketCount > 1) {
      throw new ConflictError({
        code: API_ERROR_CODES.TICKET_NOT_REVERSIBLE,
        message: `Este cobro incluye ${charge.ticketCount} lavados: deshacelo completo.`,
        details: {
          chargeId: charge.id,
          chargeNumber: charge.number,
          ticketCount: charge.ticketCount,
        },
      });
    }

    const target: VoidChargeTarget =
      charge === null ? { workOrderId: ticket.id } : { chargeId: charge.id };
    const voided = await this.undo(target, { reason, authorizer }, actor);

    return voided.tickets;
  }

  private async undo(
    target: VoidChargeTarget,
    request: AccountVoidRequest,
    actor: CarwashEventActor | null,
  ): Promise<VoidedAccount> {
    const session = await this.cashSessions.findOpen();

    if (session === null) {
      throw new ConflictError({
        code: API_ERROR_CODES.CASH_NOT_OPEN,
        message: 'Abrí la caja para deshacer el cobro.',
      });
    }

    try {
      const voided = await this.charges.void(
        target,
        {
          reason: signed(request.reason, request.authorizer?.fullName ?? null),
          cashSessionId: session.id,
          sale: {
            reason: request.reason,
            voidedByUserId: request.authorizer?.id ?? null,
            userId: actor?.kind === 'user' ? actor.id : null,
          },
        },
        actor,
      );

      for (const ticket of voided.tickets) {
        publishTicketEvent(this.events, {
          type: 'ticket.reversed',
          ticket,
          previousStatus: 'PAID',
          actor,
        });
      }

      publishLowStock(this.lowStock, voided.lowStock, actor);

      return { tickets: voided.tickets, counterSaleId: voided.counterSaleId };
    } catch (error) {
      if (error instanceof CashSessionGoneError) {
        throw new ConflictError({
          code: API_ERROR_CODES.CASH_NOT_OPEN,
          message: 'Abrí la caja para deshacer el cobro.',
        });
      }

      if (error instanceof ChargeNotVoidableError) {
        throw new ConflictError({
          code: API_ERROR_CODES.TICKET_NOT_REVERSIBLE,
          message: 'Ese cobro no es de la caja abierta. No se puede deshacer.',
        });
      }

      throw error;
    }
  }

  /**
   * Cada transferencia entra a una cuenta del negocio que existe y esta activa
   * (069 RN-4, RN-8). Se mira aca, antes de tocar nada, para todo cobro: el
   * lavado suelto, la cuenta y la venta suelta pasan por este mismo metodo.
   * El schema ya exige la cuenta; si igual llega una transferencia sin ella
   * (una llamada interna), tampoco se cobra.
   */
  private async assertBankAccounts(lines: readonly ChargeLine[]): Promise<void> {
    const requested = transferAccountIdsOf(lines);
    const active = new Set(await this.bankAccounts.findActiveIds(requested));
    const unavailable = requested.filter((id) => !active.has(id));

    if (hasTransferWithoutAccount(lines) || unavailable.length > 0) {
      throw bankAccountUnavailable(unavailable);
    }
  }

  /**
   * Precio y total de cada producto suelto contra el catalogo (065 RN-21). La
   * existencia no se mira aca: la valida el kardex con la fila bloqueada,
   * dentro de la transaccion (RN-19).
   */
  private async priceProducts(products: readonly ChargeProductInput[]): Promise<PricedSaleLine[]> {
    const catalog = await this.inventory.findByIds(
      products.map((product) => product.inventoryItemId),
    );
    const result = priceSaleLines(
      products.map((product) => ({
        inventoryItemId: product.inventoryItemId,
        quantity: fromQuantityString(product.quantity),
        unitPrice: product.unitPrice === undefined ? null : toCents(product.unitPrice),
      })),
      catalog,
    );

    if (!result.ok) throw lineRejection(result.rejection);

    return result.lines;
  }

  /**
   * La firma de la 060 cuando algun producto baja del precio (065 RN-21). Se
   * pide siempre, aunque el de la sesion tenga la clave (060 RN-3), y con
   * motivo. Sin lineas rebajadas no hay nada que firmar y el bloque se ignora.
   */
  private async signPrices(
    lines: readonly PricedSaleLine[],
    priceAuthorization: PriceAuthorizationInput | undefined,
  ): Promise<SalePriceSignature | null> {
    if (!needsPriceAuthorization(lines)) return null;

    if (priceAuthorization === undefined) {
      throw new ValidationError({
        code: API_ERROR_CODES.PRICE_CHANGE_NOT_AUTHORIZED,
        message: 'Un precio menor al del producto necesita la autorización de un encargado.',
      });
    }

    const signer = await this.authorizer.authorize(priceAuthorization.authorization, [
      PERMISSIONS.carwash.actions.discount.key,
    ]);

    return { userId: signer.id, reason: priceAuthorization.reason };
  }

  /**
   * Los lavados de la cuenta, ya verificados (RN-4). Si uno solo no se puede
   * cobrar, no se cobra ninguno: la cuenta es todo o nada.
   */
  private async loadChargeable(ids: readonly string[]): Promise<Ticket[]> {
    const tickets: Ticket[] = [];

    for (const id of ids) {
      const ticket = await this.tickets.findById(id);

      if (ticket === null) {
        throw new NotFoundError({
          code: API_ERROR_CODES.NOT_FOUND,
          message: 'Ese lavado no existe.',
        });
      }

      tickets.push(ticket);
    }

    const charged = tickets.filter(isAlreadyCharged);

    if (charged.length > 0) {
      throw new ConflictError({
        code: API_ERROR_CODES.TICKET_ALREADY_CHARGED,
        message:
          charged.length === 1
            ? 'Ese lavado ya está cobrado.'
            : 'Hay lavados de la cuenta que ya están cobrados.',
        details: { ticketNumbers: charged.map((ticket) => ticket.number) },
      });
    }

    const notReady = tickets.filter((ticket) => ticket.status !== 'READY');

    if (notReady.length > 0) {
      throw new ConflictError({
        code: API_ERROR_CODES.TICKET_NOT_READY,
        message: 'Solo se cobra un lavado que está listo.',
        details: { ticketNumbers: notReady.map((ticket) => ticket.number) },
      });
    }

    return tickets;
  }

  /**
   * RN-3 y RN-10, con los codigos y los cuerpos que ya usaba el cobro simple.
   * `withProducts` cambia solo el texto: una cuenta con productos no es «un
   * lavado».
   */
  private rejectAccount(
    buckets: readonly Cents[],
    lines: readonly ChargeLine[],
    tendered: Cents | null,
    total: Cents,
    withProducts: boolean,
  ): void {
    const rejection = rejectChargeAccount(buckets, lines, tendered);

    if (rejection === 'EMPTY_TOTAL') {
      throw new ValidationError({
        code: API_ERROR_CODES.PAYMENT_AMOUNT_MISMATCH,
        message: withProducts
          ? 'Una cuenta en cero no se cobra.'
          : 'Un lavado en cero no se cobra: se anula como cortesía.',
      });
    }

    if (rejection === 'AMOUNT_MISMATCH') {
      const amount = sumCents(lines.map((line) => line.amount));

      throw new ValidationError({
        code: API_ERROR_CODES.PAYMENT_AMOUNT_MISMATCH,
        message: withProducts
          ? 'El monto tiene que ser igual al total de la cuenta.'
          : 'El monto tiene que ser igual al total del lavado.',
        details: { total: toDecimalString(total), amount: toDecimalString(amount) },
      });
    }

    if (rejection === 'CASH_TENDERED_SHORT') {
      throw new ValidationError({
        code: API_ERROR_CODES.CASH_TENDERED_SHORT,
        message: 'El efectivo que recibiste no alcanza para la parte en efectivo del cobro.',
      });
    }
  }

  /** Lo que se perdio en la carrera contra otra caja, ya traducido a HTTP. */
  private chargeFailure(error: unknown): unknown {
    if (error instanceof CashSessionGoneError) {
      return new ConflictError({
        code: API_ERROR_CODES.CASH_NOT_OPEN,
        message: 'Abrí la caja para cobrar.',
      });
    }

    if (error instanceof TicketsNotChargeableError) {
      return new ConflictError({
        code: API_ERROR_CODES.TICKET_ALREADY_CHARGED,
        message: 'Alguien cobró uno de estos lavados mientras armabas la cuenta.',
        details: { workOrderIds: error.workOrderIds },
      });
    }

    if (error instanceof BankAccountUnavailableError) {
      return bankAccountUnavailable(error.bankAccountIds);
    }

    // Lo que el kardex rechazo al sacar los productos de la venta (065 RN-19).
    return stockFailure(error);
  }
}

/** La cuenta de una transferencia no existe o esta inactiva (069 RN-8). */
function bankAccountUnavailable(bankAccountIds: readonly string[]): ValidationError {
  return new ValidationError({
    code: API_ERROR_CODES.BANK_ACCOUNT_UNAVAILABLE,
    message: 'La cuenta de la transferencia no está disponible. Elegí otra.',
    details: { bankAccountIds: [...bankAccountIds] },
  });
}

/** Por que un producto suelto no se puede vender, ya traducido a HTTP (065 RN-21). */
function lineRejection(rejection: SaleLineRejection): Error {
  switch (rejection.reason) {
    case 'NOT_FOUND':
      return new NotFoundError({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Uno de los productos no existe.',
        details: { itemId: rejection.itemId },
      });
    case 'INACTIVE':
      return new ConflictError({
        code: API_ERROR_CODES.ITEM_INACTIVE,
        message: 'Uno de los productos está desactivado.',
        details: { itemId: rejection.itemId },
      });
    case 'NOT_SELLABLE':
      return new ConflictError({
        code: API_ERROR_CODES.ITEM_NOT_SELLABLE,
        message: 'Un insumo no se vende.',
        details: { itemId: rejection.itemId },
      });
    case 'ABOVE_CATALOG':
      return new ValidationError({
        code: API_ERROR_CODES.PRICE_ABOVE_CATALOG,
        message: 'El precio no puede pasar el del producto.',
        details: {
          itemId: rejection.itemId,
          catalogPrice: toDecimalString(rejection.catalogPrice),
        },
      });
  }
}

/**
 * Un lavado ya cobrado (RN-4). Se mira el pago y la cuenta, no solo el estado:
 * un lavado con pago pero fuera de `PAID` seria plata cobrada dos veces.
 */
function isAlreadyCharged(ticket: Ticket): boolean {
  return ticket.status === 'PAID' || ticket.charge !== null || ticket.payments.length > 0;
}

/**
 * La comision se congela **por lavado**, no por cuenta (009 RN-1), y solo
 * sobre sus servicios (065 RN-8): los productos cobran pero no comisionan.
 */
function chargeTicketData(ticket: Ticket, total: Cents, payments: ChargeLine[]): ChargeTicketData {
  const commissionTotal = commissionFor(
    commissionBaseOf(ticket.items.map((item) => ({ kind: item.kind, total: toCents(item.total) }))),
  );
  const shares = splitCommission(commissionTotal, ticket.washers.length);

  return {
    workOrderId: ticket.id,
    total,
    commissionTotal,
    entries: ticket.washers.map((washer, index) => ({
      employeeId: washer.id,
      amount: shares[index] ?? 0,
    })),
    payments,
  };
}
