import { API_ERROR_CODES } from '@elite/shared';
import type {
  AddTabLinesInput,
  CarwashEventActor,
  PayTabInput,
  TabDetail,
  TabHolderOptions,
  TabHoldersQuery,
  TabList,
  TabsQuery,
  VoidTabLineInput,
} from '@elite/shared';

import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../common/errors/application-error';
import { stockFailure } from '../../carwash/application/stock-failure';
import { toCents, toDecimalString } from '../../carwash/domain/money';
import { fromQuantityString } from '../../inventory/domain/stock';
import {
  publishLowStock,
  type LowStockPublisher,
} from '../../inventory/application/ports/low-stock-events';
import {
  rejectLineVoid,
  rejectTabPayment,
  type TabFigures,
  type TabRejection,
} from '../domain/tab';
import type { TabLookups } from './ports/tab-lookups';
import {
  TabBankAccountUnavailableError,
  TabCashSessionGoneError,
  TabNotFoundError,
  TabRuleError,
  type TabRepository,
} from './ports/tab.repository';

/** Quien hace la operación: siempre un usuario de oficina (RN-9). */
export interface TabActorContext {
  userId: string;
  event: CarwashEventActor | null;
}

/**
 * Cuentas abiertas (106): lo que alguien se lleva y paga después.
 *
 * Anotar saca el producto del inventario y lo suma a la cuenta del titular —o
 * le abre una, en la misma transacción—; quitar lo devuelve; abonar mete el
 * dinero al turno de caja abierto y, si el saldo llega a cero, cierra la
 * cuenta. Cada regla se valida acá con lo leído y el repositorio la vuelve a
 * mirar con la fila bloqueada.
 */
export class TabUseCases {
  constructor(
    private readonly tabs: TabRepository,
    private readonly lookups: TabLookups,
    private readonly lowStock: LowStockPublisher,
  ) {}

  list(query: TabsQuery): Promise<TabList> {
    return this.tabs.list(query);
  }

  holders(query: TabHoldersQuery): Promise<TabHolderOptions> {
    const search = query.search?.trim() ?? '';

    return this.tabs.holders(search === '' ? null : search);
  }

  async findById(id: string): Promise<TabDetail> {
    const tab = await this.tabs.findById(id);

    if (tab === null) throw tabNotFound();

    return tab;
  }

  /**
   * Anota productos a un titular (RN-1 a RN-4). Un empleado tiene que estar
   * activo; las reglas del producto (vendible, activo, con existencia) las
   * aplica el kardex con la fila bloqueada.
   *
   * @throws 404 EMPLOYEE_NOT_FOUND / NOT_FOUND (titular), 409 INSUFFICIENT_STOCK,
   * 409 ITEM_NOT_SELLABLE, 409 ITEM_INACTIVE, 422 VALIDATION_ERROR (producto que no existe).
   */
  async addLines(input: AddTabLinesInput, actor: TabActorContext): Promise<TabDetail> {
    const holder = await this.lookups.findHolder(input.holder);

    if (holder === null) {
      throw input.holder.kind === 'EMPLOYEE'
        ? new NotFoundError({
            code: API_ERROR_CODES.EMPLOYEE_NOT_FOUND,
            message: 'Ese empleado no existe o está desactivado.',
            details: { employeeId: input.holder.id },
          })
        : new NotFoundError({
            code: API_ERROR_CODES.NOT_FOUND,
            message: 'Ese cliente no existe.',
            details: { customerId: input.holder.id },
          });
    }

    try {
      const result = await this.tabs.addLines({
        holder: input.holder,
        items: input.items.map((item) => ({
          inventoryItemId: item.inventoryItemId,
          quantity: fromQuantityString(item.quantity),
        })),
        userId: actor.userId,
      });

      publishLowStock(this.lowStock, result.lowStock, actor.event);

      return this.findById(result.tabId);
    } catch (error) {
      throw stockFailure(error);
    }
  }

  /**
   * Quita una línea con motivo, una sola vez (RN-5): el producto vuelve al
   * inventario y el saldo baja. No en una cuenta cerrada ni si el saldo
   * quedaría bajo lo ya abonado.
   *
   * @throws 404 NOT_FOUND, 409 TAB_CLOSED, 409 TAB_LINE_ALREADY_VOIDED,
   * 409 TAB_LINE_NOT_VOIDABLE.
   */
  async voidLine(
    tabId: string,
    lineId: string,
    input: VoidTabLineInput,
    actor: TabActorContext,
  ): Promise<TabDetail> {
    const tab = await this.findById(tabId);
    const line = tab.lines.find((candidate) => candidate.id === lineId);

    if (line === undefined) throw lineNotFound();

    const rejection = rejectLineVoid(figuresOf(tab), {
      total: toCents(line.total),
      voided: line.voided !== null,
    });

    if (rejection !== null) throw ruleError(rejection);

    try {
      const result = await this.tabs.voidLine({
        tabId,
        lineId,
        reason: input.reason,
        userId: actor.userId,
      });

      publishLowStock(this.lowStock, result.lowStock, actor.event);
    } catch (error) {
      throw this.writeFailure(error, lineNotFound);
    }

    return this.findById(tabId);
  }

  /**
   * Un abono (RN-7): entra al turno de caja abierto con su método, con las
   * reglas de método de cualquier cobro (069). Si deja el saldo en cero, la
   * cuenta se cierra (RN-8).
   *
   * @throws 404 NOT_FOUND, 409 TAB_CLOSED, 422 PAYMENT_EXCEEDS_BALANCE,
   * 422 BANK_ACCOUNT_UNAVAILABLE, 409 CASH_NOT_OPEN.
   */
  async pay(tabId: string, input: PayTabInput, actor: TabActorContext): Promise<TabDetail> {
    const tab = await this.findById(tabId);
    const amount = toCents(input.amount);
    const rejection = rejectTabPayment(figuresOf(tab), amount);

    if (rejection !== null) throw ruleError(rejection);

    const bankAccountId = input.bankAccountId ?? null;

    if (bankAccountId !== null) {
      const active = await this.lookups.findActiveBankAccountIds([bankAccountId]);

      if (!active.includes(bankAccountId)) throw bankAccountUnavailable(bankAccountId);
    }

    const cashSessionId = await this.lookups.findOpenCashSessionId();

    if (cashSessionId === null) throw cashNotOpen();

    try {
      await this.tabs.pay({
        tabId,
        method: input.method,
        amount,
        bankAccountId,
        reference: input.reference ?? null,
        description: input.description ?? null,
        userId: actor.userId,
        cashSessionId,
      });
    } catch (error) {
      throw this.writeFailure(error, tabNotFound);
    }

    return this.findById(tabId);
  }

  /** Lo que el repositorio rechazó con la fila bloqueada, ya traducido. */
  private writeFailure(error: unknown, notFound: () => NotFoundError): unknown {
    if (error instanceof TabRuleError) return ruleError(error.rejection);
    if (error instanceof TabNotFoundError) return notFound();
    if (error instanceof TabCashSessionGoneError) return cashNotOpen();
    if (error instanceof TabBankAccountUnavailableError) {
      return bankAccountUnavailable(error.bankAccountId);
    }

    return stockFailure(error);
  }
}

function figuresOf(tab: TabDetail): TabFigures {
  return {
    total: toCents(tab.total),
    paid: toCents(tab.paid),
    balance: toCents(tab.balance),
    closed: tab.status === 'CLOSED',
  };
}

/** Cada regla con su código, igual desde la validación previa que desde la fila bloqueada. */
function ruleError(rejection: TabRejection): Error {
  switch (rejection.reason) {
    case 'TAB_CLOSED':
      return new ConflictError({
        code: API_ERROR_CODES.TAB_CLOSED,
        message: 'Esa cuenta ya está cerrada.',
      });
    case 'LINE_ALREADY_VOIDED':
      return new ConflictError({
        code: API_ERROR_CODES.TAB_LINE_ALREADY_VOIDED,
        message: 'Esa línea ya se quitó.',
      });
    case 'LINE_BELOW_PAID':
      return new ConflictError({
        code: API_ERROR_CODES.TAB_LINE_NOT_VOIDABLE,
        message: 'No se puede quitar: el saldo quedaría por debajo de lo ya abonado.',
        details: {
          balance: toDecimalString(rejection.balance),
          lineTotal: toDecimalString(rejection.lineTotal),
        },
      });
    case 'PAYMENT_NOT_POSITIVE':
      return new ValidationError({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'El abono tiene que ser mayor que cero.',
        details: { amount: 'El abono tiene que ser mayor que cero.' },
      });
    case 'PAYMENT_OVER_BALANCE':
      return new ValidationError({
        code: API_ERROR_CODES.PAYMENT_EXCEEDS_BALANCE,
        message: `El abono pasa del saldo de la cuenta ($${toDecimalString(rejection.balance)}).`,
        details: { balance: toDecimalString(rejection.balance) },
      });
  }
}

function tabNotFound(): NotFoundError {
  return new NotFoundError({ code: API_ERROR_CODES.NOT_FOUND, message: 'Esa cuenta no existe.' });
}

function lineNotFound(): NotFoundError {
  return new NotFoundError({
    code: API_ERROR_CODES.NOT_FOUND,
    message: 'Esa línea no es de esta cuenta.',
  });
}

function cashNotOpen(): ConflictError {
  return new ConflictError({
    code: API_ERROR_CODES.CASH_NOT_OPEN,
    message: 'Abrí la caja para cobrar.',
  });
}

/** La cuenta de una transferencia no existe o está inactiva (069 RN-8). */
function bankAccountUnavailable(bankAccountId: string): ValidationError {
  return new ValidationError({
    code: API_ERROR_CODES.BANK_ACCOUNT_UNAVAILABLE,
    message: 'La cuenta de la transferencia no está disponible. Elegí otra.',
    details: { bankAccountIds: [bankAccountId] },
  });
}
