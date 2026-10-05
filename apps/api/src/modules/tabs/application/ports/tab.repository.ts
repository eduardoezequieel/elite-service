import type {
  InventoryLowStockPayload,
  PaymentMethod,
  TabDetail,
  TabHolderOptions,
  TabHolderRef,
  TabList,
  TabsQuery,
} from '@elite/shared';

import type { Cents } from '../../../carwash/domain/money';
import type { Milli } from '../../../inventory/domain/stock';
import type { TabRejection } from '../../domain/tab';

/**
 * Las cuentas abiertas (105), del lado de la base.
 *
 * Cada escritura es una transacción con la fila de la cuenta bloqueada: el
 * caso de uso valida con lo que leyó y el repositorio lo vuelve a mirar
 * adentro (como el lavado, 090). Si cambió, lanza `TabRuleError` con la misma
 * regla, que el caso de uso traduce igual que su propia validación.
 */

export interface AddTabLinesData {
  holder: TabHolderRef;
  items: { inventoryItemId: string; quantity: Milli }[];
  userId: string;
}

export interface AddTabLinesResult {
  tabId: string;
  /** Avisos de mínimo para publicar tras el commit (065 RN-13). */
  lowStock: InventoryLowStockPayload[];
}

export interface VoidTabLineData {
  tabId: string;
  lineId: string;
  reason: string;
  userId: string;
}

export interface TabPaymentData {
  tabId: string;
  method: PaymentMethod;
  amount: Cents;
  bankAccountId: string | null;
  reference: string | null;
  description: string | null;
  userId: string;
  cashSessionId: string;
}

export interface TabRepository {
  findById(id: string): Promise<TabDetail | null>;
  /** Los totales de todas las cuentas y una página filtrada, por saldo (102). */
  list(query: TabsQuery): Promise<TabList>;
  /** Empleados activos y clientes que coinciden, con su cuenta abierta. */
  holders(search: string | null): Promise<TabHolderOptions>;
  /**
   * Anota a la cuenta abierta del titular o le abre una (RN-2), con un `SALE`
   * por línea en el kardex y el precio leído de la fila bloqueada (RN-4).
   *
   * @throws los errores del kardex (`InsufficientStockError`, `ItemInactiveError`,
   * `ItemNotSellableError`, `InventoryItemNotFoundError`).
   */
  addLines(data: AddTabLinesData): Promise<AddTabLinesResult>;
  /**
   * Quita la línea con un `SALE_RETURN` que apunta a su `SALE` (RN-5).
   *
   * @throws TabRuleError, TabNotFoundError.
   */
  voidLine(data: VoidTabLineData): Promise<{ lowStock: InventoryLowStockPayload[] }>;
  /**
   * Un abono en el turno abierto (RN-7).
   *
   * @throws TabRuleError, TabNotFoundError, TabCashSessionGoneError,
   * TabBankAccountUnavailableError.
   */
  pay(data: TabPaymentData): Promise<void>;
}

/** La regla dejó de cumplirse entre la lectura y la escritura. */
export class TabRuleError extends Error {
  constructor(readonly rejection: TabRejection) {
    super(`Tab rule rejected: ${rejection.reason}`);
    this.name = 'TabRuleError';
  }
}

/** La cuenta o la línea no existen. */
export class TabNotFoundError extends Error {
  constructor() {
    super('Tab or tab line not found');
    this.name = 'TabNotFoundError';
  }
}

/** El turno se cerró entre la validación y el abono. */
export class TabCashSessionGoneError extends Error {
  constructor() {
    super('Cash session is not open');
    this.name = 'TabCashSessionGoneError';
  }
}

/** La cuenta de la transferencia se desactivó entre la validación y el abono (069 RN-8). */
export class TabBankAccountUnavailableError extends Error {
  constructor(readonly bankAccountId: string) {
    super('Bank account unavailable');
    this.name = 'TabBankAccountUnavailableError';
  }
}

export const TAB_REPOSITORY = Symbol('tabs.TabRepository');
