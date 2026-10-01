import { centsToMoney, moneyToCents } from '@elite/shared';
import type { BillingAgreementView } from '@elite/shared';

/**
 * Cuentas chicas de la pantalla de cobro de la renta (098). Puras, para
 * probarlas sin React.
 */

/** Dónde está el depósito de una renta (RN-2). */
export type DepositStatus =
  | { kind: 'none' }
  | { kind: 'held'; amount: string }
  | { kind: 'returned'; amount: string; returned: string; retained: string }
  | { kind: 'transferred'; amount: string; toId: string };

export function depositStatus(
  agreement: Pick<
    BillingAgreementView,
    'deposit' | 'depositReturnedAmount' | 'depositTransferredToId'
  >,
): DepositStatus {
  const deposit = moneyToCents(agreement.deposit);

  if (agreement.depositTransferredToId !== null) {
    return {
      kind: 'transferred',
      amount: agreement.deposit,
      toId: agreement.depositTransferredToId,
    };
  }
  if (agreement.depositReturnedAmount !== null) {
    const returned = moneyToCents(agreement.depositReturnedAmount);

    return {
      kind: 'returned',
      amount: agreement.deposit,
      returned: agreement.depositReturnedAmount,
      retained: centsToMoney(Math.max(0, deposit - returned)),
    };
  }
  if (deposit <= 0) return { kind: 'none' };

  return { kind: 'held', amount: agreement.deposit };
}

/** El saldo que todavía se puede cobrar, en centavos (nunca negativo). */
export function collectibleCents(balance: string): number {
  return Math.max(0, moneyToCents(balance));
}

/** El Salvador no tiene horario de verano: siempre UTC−6. */
const SALVADOR_OFFSET = '-06:00';
const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * Lo que da un `<input type="datetime-local">` (`2026-10-01T14:30`) como
 * instante en la hora del negocio, sin importar el huso del navegador. `null`
 * si está vacío o incompleto.
 */
export function salvadorInstant(local: string): string | null {
  const match = LOCAL_RE.exec(local.trim());

  if (match === null) return null;

  const instant = new Date(`${local.trim()}:00${SALVADOR_OFFSET}`);

  return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
}

/** Ahora en El Salvador, en el formato del `datetime-local`. */
export function salvadorLocalNow(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() - 6 * 60 * 60 * 1000);

  return shifted.toISOString().slice(0, 16);
}
