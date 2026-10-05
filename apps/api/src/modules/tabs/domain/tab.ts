/**
 * Cuentas abiertas (106): reglas puras, sin Nest ni Prisma.
 *
 * Una cuenta suma lo anotado (las líneas no quitadas) y resta lo abonado; el
 * saldo nunca baja de cero y, cuando llega a cero, la cuenta se cierra sola.
 * Todo en enteros: dinero en centavos y cantidades en milésimas.
 */
import type { Cents } from '../../carwash/domain/money';
import type { Milli } from '../../inventory/domain/stock';
import { saleLineTotal } from '../../sales/domain/counter-sale';

/** Lo que las reglas necesitan saber de una cuenta. */
export interface TabFigures {
  total: Cents;
  paid: Cents;
  balance: Cents;
  closed: boolean;
}

/** Cómo queda una cuenta tras un cambio; `closes` = el saldo llegó a cero (RN-8). */
export interface TabFiguresAfter {
  total: Cents;
  paid: Cents;
  balance: Cents;
  closes: boolean;
}

/** Por qué no se puede quitar una línea o recibir un abono. */
export type TabRejection =
  | { reason: 'TAB_CLOSED' }
  | { reason: 'LINE_ALREADY_VOIDED' }
  | { reason: 'LINE_BELOW_PAID'; balance: Cents; lineTotal: Cents }
  | { reason: 'PAYMENT_NOT_POSITIVE' }
  | { reason: 'PAYMENT_OVER_BALANCE'; balance: Cents };

/** `unitPrice × quantity` al centavo: la misma cuenta que la venta suelta (065 RN-6). */
export function tabLineTotal(unitPrice: Cents, quantity: Milli): Cents {
  return saleLineTotal(unitPrice, quantity);
}

/** Lo anotado de una vez se suma al total y al saldo; anotar no cierra (RN-4). */
export function afterLines(tab: TabFigures, added: Cents): TabFiguresAfter {
  return {
    total: tab.total + added,
    paid: tab.paid,
    balance: tab.balance + added,
    closes: false,
  };
}

/**
 * Quitar una línea (RN-5): la cuenta tiene que estar abierta, la línea sin
 * quitar y el saldo no puede quedar bajo cero —lo ya abonado no se devuelve—.
 */
export function rejectLineVoid(
  tab: TabFigures,
  line: { total: Cents; voided: boolean },
): TabRejection | null {
  if (tab.closed) return { reason: 'TAB_CLOSED' };
  if (line.voided) return { reason: 'LINE_ALREADY_VOIDED' };
  if (tab.balance - line.total < 0) {
    return { reason: 'LINE_BELOW_PAID', balance: tab.balance, lineTotal: line.total };
  }

  return null;
}

/** La cuenta sin la línea; si el saldo queda en cero, se cierra (RN-8). */
export function afterVoid(tab: TabFigures, lineTotal: Cents): TabFiguresAfter {
  const balance = tab.balance - lineTotal;

  return { total: tab.total - lineTotal, paid: tab.paid, balance, closes: balance === 0 };
}

/** Un abono (RN-7): cuenta abierta, monto mayor que cero y hasta el saldo. */
export function rejectTabPayment(tab: TabFigures, amount: Cents): TabRejection | null {
  if (tab.closed) return { reason: 'TAB_CLOSED' };
  if (amount <= 0) return { reason: 'PAYMENT_NOT_POSITIVE' };
  if (amount > tab.balance) return { reason: 'PAYMENT_OVER_BALANCE', balance: tab.balance };

  return null;
}

/** La cuenta tras el abono; el que la deja en cero la cierra (RN-8). */
export function afterPayment(tab: TabFigures, amount: Cents): TabFiguresAfter {
  const balance = tab.balance - amount;

  return { total: tab.total, paid: tab.paid + amount, balance, closes: balance === 0 };
}

/**
 * Lo que busca el número en la lista: `C-0012`, `c-12` y `12` encuentran la
 * misma cuenta. `null` si el texto no parece un número de cuenta.
 */
export function tabNumberQuery(search: string, prefix: string): string | null {
  const match = new RegExp(`^(?:${prefix}-?)?0*(\\d+)$`, 'i').exec(search.trim());

  return match === null ? null : match[1];
}
