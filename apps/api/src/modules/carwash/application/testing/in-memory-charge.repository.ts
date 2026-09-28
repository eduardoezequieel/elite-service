import type {
  Charge,
  ChargePayment,
  ChargeSaleRef,
  CounterSale,
  InventoryLowStockPayload,
  PaymentMethod,
  PaymentMethodDetails,
  Ticket,
  WorkOrderStatus,
} from '@elite/shared';

import { saleLineTotal, SALE_PREFIX } from '../../../sales/domain/counter-sale';
import { fromQuantityString, toQuantityString } from '../../../inventory/domain/stock';
import { sumCents, type ChargeLine } from '../../domain/charge';
import { toDecimalString } from '../../domain/money';
import { CHARGE_PREFIX, formatNumber } from '../../domain/numbering';
import type { StatusActor } from '../ports/ticket.repository';
import {
  ChargeNotVoidableError,
  type ChargeRepository,
  type ChargeSaleData,
  type ChargeWriteResult,
  type NewChargeData,
  type VoidChargeData,
  type VoidChargeResult,
  type VoidChargeTarget,
} from '../ports/charge.repository';
import { InMemoryBankAccountDirectory } from './in-memory-bank-account-directory';
import type { InMemoryStock } from './in-memory-ticket.repository';

/**
 * Los lavados que el cobro toca. Es lo minimo que la cuenta necesita del
 * mundo: leerlos y volver a dejarlos como quedaron.
 */
export interface ChargeableTickets {
  get(id: string): Ticket | undefined;
  set(ticket: Ticket): void;
  /** La fila del historial que el repositorio real escribe (046 RN-1). */
  record?(
    id: string,
    fromStatus: WorkOrderStatus,
    toStatus: WorkOrderStatus,
    actor: StatusActor,
  ): void;
}

/** Lavados sueltos en memoria, para los tests que no arman un repositorio. */
export class InMemoryTickets implements ChargeableTickets {
  constructor(public rows: Ticket[] = []) {}

  get(id: string): Ticket | undefined {
    return this.rows.find((row) => row.id === id);
  }

  set(ticket: Ticket): void {
    const index = this.rows.findIndex((row) => row.id === ticket.id);

    if (index === -1) this.rows.push(ticket);
    else this.rows[index] = ticket;
  }

  async findById(id: string): Promise<Ticket | null> {
    return this.get(id) ?? null;
  }
}

/** Una venta suelta guardada en memoria, con el turno y el dia en que se cobro. */
export interface InMemorySale {
  sale: CounterSale;
  cashSessionId: string;
  /** Dia civil de la venta, para el filtro del listado. */
  date: string;
}

/**
 * La cuenta de cobro en memoria (059, 066). Escribe lo mismo que el
 * repositorio real —lavados a `PAID`, venta suelta con su salida del kardex,
 * pagos repartidos, cuenta con su correlativo— pero sin base: los tests de caso
 * de uso no tocan Postgres.
 *
 * Los productos sueltos necesitan un kardex (`stock`); sin el, una cuenta con
 * productos falla, igual que fallaria contra una base sin inventario.
 */
export class InMemoryChargeRepository implements ChargeRepository {
  constructor(
    private readonly tickets: ChargeableTickets,
    readonly stock: InMemoryStock | null = null,
  ) {}

  /**
   * Las cuentas del negocio (069): de aca sale el `bankAccount` de cada pago.
   * Los tests se la pasan tambien a `ChargeUseCases` como su directorio.
   */
  readonly bankAccounts = new InMemoryBankAccountDirectory();
  lastCreated: NewChargeData | null = null;
  lastVoided: { target: VoidChargeTarget; data: VoidChargeData } | null = null;
  /** Las ventas sueltas (065), por id. Las lee el repositorio de ventas en memoria. */
  readonly sales = new Map<string, InMemorySale>();
  /** Nombres de usuario para `createdBy` / `voidedBy` de la venta. */
  readonly users = new Map<string, string>();
  /** Dia civil que se le pone a la proxima venta. */
  today = '2026-09-26';
  /** Si se setea, `create` lo lanza antes de escribir: simula perder una carrera. */
  failNextCreate: Error | null = null;

  private readonly stored = new Map<string, Charge>();
  private sequence = 0;
  private saleSequence = 0;

  async create(data: NewChargeData, actor: StatusActor): Promise<ChargeWriteResult> {
    if (this.failNextCreate !== null) {
      const error = this.failNextCreate;

      this.failNextCreate = null;
      throw error;
    }

    this.lastCreated = data;

    const id = `charge-${this.sequence + 1}`;
    const number = formatNumber(CHARGE_PREFIX, this.sequence + 1);
    const chargedAt = new Date(Date.UTC(2026, 8, 20, 16, this.sequence + 1)).toISOString();

    // La venta primero y todo o nada, igual que la transaccion real: si un
    // producto no alcanza, el kardex lanza antes de tocar ningun lavado.
    const saleId = data.sale === null ? null : `sale-${this.saleSequence + 1}`;
    const lowStock =
      data.sale === null || saleId === null
        ? []
        : this.takeStock(data.sale, saleId, { kind: 'user', id: data.userId, name: 'Cajero' });

    this.sequence += 1;
    if (saleId !== null) this.saleSequence += 1;

    const saleNumber = saleId === null ? null : formatNumber(SALE_PREFIX, this.saleSequence);
    const ref = {
      id,
      number,
      ticketCount: data.tickets.length,
      total: toDecimalString(data.total),
      cashTendered: data.cashTendered === null ? null : toDecimalString(data.cashTendered),
      changeGiven: data.changeGiven === null ? null : toDecimalString(data.changeGiven),
      counterSale:
        saleId === null || saleNumber === null ? null : { id: saleId, number: saleNumber },
    };

    const tickets = data.tickets.map((entry) => {
      const before = this.tickets.get(entry.workOrderId);

      if (before === undefined) throw new Error(`Unknown ticket ${entry.workOrderId}`);

      const charged: Ticket = {
        ...before,
        status: 'PAID',
        commissionTotal: toDecimalString(entry.commissionTotal),
        payments: entry.payments.map((payment) => ({
          method: payment.method,
          amount: toDecimalString(payment.amount),
          paidAt: chargedAt,
          recordedBy: { id: data.userId, fullName: 'Cajero' },
          ...this.detailsOf(payment),
        })),
        charge: ref,
      };

      this.tickets.set(charged);
      this.tickets.record?.(charged.id, 'READY', 'PAID', actor);

      return charged;
    });

    let counterSale: ChargeSaleRef | null = null;

    if (data.sale !== null && saleId !== null && saleNumber !== null) {
      const sale = this.storeSale(
        data,
        data.sale,
        { id: saleId, number: saleNumber },
        ref,
        tickets,
      );

      counterSale = {
        id: sale.id,
        number: sale.number,
        customerName: sale.customerName,
        total: sale.total,
        items: sale.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
      };
    }

    const charge: Charge = {
      id: ref.id,
      number: ref.number,
      total: ref.total,
      cashTendered: ref.cashTendered,
      changeGiven: ref.changeGiven,
      chargedAt,
      chargedBy: { id: data.userId, fullName: 'Cajero' },
      payments: this.mergeByMethod(data),
      tickets,
      counterSale,
    };

    this.stored.set(id, charge);

    return { charge, lowStock };
  }

  async findById(id: string): Promise<Charge | null> {
    return this.stored.get(id) ?? null;
  }

  async void(
    target: VoidChargeTarget,
    data: VoidChargeData,
    actor: StatusActor,
  ): Promise<VoidChargeResult> {
    this.lastVoided = { target, data };

    const charge =
      'chargeId' in target
        ? this.stored.get(target.chargeId)
        : [...this.stored.values()].find((stored) =>
            stored.tickets.some((ticket) => ticket.id === target.workOrderId),
          );

    if (charge === undefined) throw new ChargeNotVoidableError();

    const sale = charge.counterSale === null ? undefined : this.sales.get(charge.counterSale.id);

    if (sale !== undefined && sale.cashSessionId !== data.cashSessionId) {
      throw new ChargeNotVoidableError();
    }

    const lowStock = sale === undefined ? [] : this.returnStock(sale, data, actor);

    this.stored.delete(charge.id);

    const tickets = charge.tickets.map((ticket) => {
      const note = `Reverso: ${data.reason}`;
      const reversed: Ticket = {
        ...(this.tickets.get(ticket.id) ?? ticket),
        status: 'READY',
        commissionTotal: null,
        payments: [],
        charge: null,
        notes: note,
      };

      this.tickets.set(reversed);
      this.tickets.record?.(reversed.id, 'PAID', 'READY', actor);

      return reversed;
    });

    return { tickets, counterSaleId: sale?.sale.id ?? null, lowStock };
  }

  private takeStock(
    sale: ChargeSaleData,
    saleId: string,
    actor: StatusActor,
  ): InventoryLowStockPayload[] {
    if (this.stock === null) throw new Error('InMemoryChargeRepository needs a stock for products');

    return this.stock.apply(
      sale.lines.map((line) => ({
        inventoryItemId: line.inventoryItemId,
        type: 'SALE',
        quantity: -line.quantity,
      })),
      { counterSaleId: saleId },
      actor,
    );
  }

  private storeSale(
    data: NewChargeData,
    sale: ChargeSaleData,
    ids: { id: string; number: string },
    charge: { id: string; number: string; cashTendered: string | null; changeGiven: string | null },
    tickets: readonly Ticket[],
  ): CounterSale {
    const stored: CounterSale = {
      id: ids.id,
      number: ids.number,
      status: 'PAID',
      customerName: sale.customerName,
      total: toDecimalString(sale.total),
      items: sale.lines.map((line, index) => ({
        id: `${ids.id}-item-${index}`,
        inventoryItemId: line.inventoryItemId,
        code: line.code,
        name: line.name,
        catalogPrice: toDecimalString(line.catalogPrice),
        unitPrice: toDecimalString(line.unitPrice),
        quantity: toQuantityString(line.quantity),
        total: toDecimalString(saleLineTotal(line.unitPrice, line.quantity)),
        priceAuthorizedBy:
          line.priceAuthorizedByUserId === null
            ? null
            : {
                id: line.priceAuthorizedByUserId,
                fullName: this.nameOf(line.priceAuthorizedByUserId),
              },
        priceReason: line.priceReason,
        sortOrder: index,
      })),
      payments: sale.payments.map((payment, index) => ({
        id: `${ids.id}-pay-${index}`,
        method: payment.method,
        amount: toDecimalString(payment.amount),
        ...this.detailsOf(payment),
      })),
      charge: { id: charge.id, number: charge.number },
      accountTickets: tickets.map((ticket) => ({ id: ticket.id, number: ticket.number })),
      cashTendered: charge.cashTendered,
      changeGiven: charge.changeGiven,
      createdBy: { id: data.userId, fullName: this.nameOf(data.userId) },
      createdAt: new Date(Date.UTC(2026, 8, 26, 16, this.saleSequence)).toISOString(),
      voidedBy: null,
      voidedAt: null,
      voidReason: null,
      isVoidable: false,
    };

    this.sales.set(ids.id, { sale: stored, cashSessionId: data.cashSessionId, date: this.today });

    return stored;
  }

  /** La venta queda `VOID` firmada y sus productos vuelven al kardex (065 RN-22). */
  private returnStock(
    stored: InMemorySale,
    data: VoidChargeData,
    actor: StatusActor,
  ): InventoryLowStockPayload[] {
    const lowStock =
      this.stock === null
        ? []
        : this.stock.apply(
            stored.sale.items.map((item) => ({
              inventoryItemId: item.inventoryItemId,
              type: 'SALE_RETURN',
              quantity: fromQuantityString(item.quantity),
            })),
            { counterSaleId: stored.sale.id },
            data.sale.userId === null ? actor : { kind: 'user', id: data.sale.userId, name: '' },
          );

    stored.sale = {
      ...stored.sale,
      status: 'VOID',
      payments: [],
      charge: null,
      accountTickets: [],
      cashTendered: null,
      changeGiven: null,
      voidedBy:
        data.sale.voidedByUserId === null
          ? null
          : { id: data.sale.voidedByUserId, fullName: this.nameOf(data.sale.voidedByUserId) },
      voidedAt: new Date(Date.UTC(2026, 8, 26, 18, 0)).toISOString(),
      voidReason: data.sale.reason,
    };

    return lowStock;
  }

  private nameOf(userId: string): string {
    return this.users.get(userId) ?? userId;
  }

  /** Los datos de la 069 de un renglon, como los devuelve un pago guardado. */
  private detailsOf(line: ChargeLine): PaymentMethodDetails {
    return {
      bankAccount: this.bankAccounts.paymentAccount(line.details?.bankAccountId ?? null),
      reference: line.details?.reference ?? null,
      description: line.details?.description ?? null,
    };
  }

  /** Los renglones como los tecleo el cajero: una fila por metodo (RN-5). */
  private mergeByMethod(data: NewChargeData): ChargePayment[] {
    const byMethod = new Map<PaymentMethod, { first: ChargeLine; amounts: number[] }>();
    const parts: ChargeLine[][] = [
      ...data.tickets.map((ticket) => ticket.payments),
      ...(data.sale === null ? [] : [data.sale.payments]),
    ];

    for (const payments of parts) {
      for (const payment of payments) {
        const entry = byMethod.get(payment.method);

        if (entry === undefined)
          byMethod.set(payment.method, { first: payment, amounts: [payment.amount] });
        else entry.amounts.push(payment.amount);
      }
    }

    return [...byMethod.entries()].map(([method, entry], index) => ({
      id: `line-${index + 1}`,
      method,
      amount: toDecimalString(sumCents(entry.amounts)),
      ...this.detailsOf(entry.first),
    }));
  }
}
