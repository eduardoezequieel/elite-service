import type { PaymentMethod } from '@elite/shared';

import { bankAccountLabel, type BankAccountIdentity } from '../../banking/domain/bank-account';
import type { Cents } from './money';

export type CashMethod = PaymentMethod;

export interface CashPaymentAmount {
  method: CashMethod;
  amount: Cents;
}

export interface MethodTotals {
  cashTotal: Cents;
  cardTotal: Cents;
  transferTotal: Cents;
  /** 069 RN-5/RN-7: «Otro» (cheque, billetera) va aparte y no es efectivo. */
  otherTotal: Cents;
}

export interface CloseSnapshot extends MethodTotals {
  expectedCash: Cents;
  differenceCash: Cents;
}

/**
 * Sum each payment method. Card, transfer and other are reported, never mixed
 * into cash.
 */
export function paymentTotals(payments: readonly CashPaymentAmount[]): MethodTotals {
  const totals: MethodTotals = { cashTotal: 0, cardTotal: 0, transferTotal: 0, otherTotal: 0 };

  for (const payment of payments) {
    switch (payment.method) {
      case 'CASH':
        totals.cashTotal += payment.amount;
        break;
      case 'CARD':
        totals.cardTotal += payment.amount;
        break;
      case 'TRANSFER':
        totals.transferTotal += payment.amount;
        break;
      case 'OTHER':
        totals.otherTotal += payment.amount;
        break;
    }
  }

  return totals;
}

/** Expected drawer contents: float already in the till plus CASH charges. */
export function expectedCash(openingFloat: Cents, cashTotal: Cents): Cents {
  return openingFloat + cashTotal;
}

/** Counted minus expected. Negative is a shortage; positive is an overage. */
export function differenceCash(countedCash: Cents, expected: Cents): Cents {
  return countedCash - expected;
}

/** Frozen totals written on close. Card/transfer/other do not change expected cash. */
export function closeSnapshot(
  openingFloat: Cents,
  payments: readonly CashPaymentAmount[],
  countedCash: Cents,
): CloseSnapshot {
  const totals = paymentTotals(payments);
  const expected = expectedCash(openingFloat, totals.cashTotal);

  return {
    ...totals,
    expectedCash: expected,
    differenceCash: differenceCash(countedCash, expected),
  };
}

/** A shift payment with the business account a transfer went into (069). */
export interface AccountedPayment extends CashPaymentAmount {
  /** `null` outside TRANSFER and on transfers recorded before 069. */
  bankAccount: (BankAccountIdentity & { id: string }) | null;
}

/** One row of the per-account transfer breakdown (069 RN-7). */
export interface TransferAccountTotal {
  /** `null` = transfers recorded before 069 («Sin cuenta»). */
  bankAccountId: string | null;
  label: string;
  total: Cents;
}

export const NO_ACCOUNT_LABEL = 'Sin cuenta';

/**
 * `transferTotal` split by business account (069 RN-7), so the shift can be
 * checked against each bank statement. Transfers without an account (older
 * than 069) get their own «Sin cuenta» row, which always goes last; the rest
 * are ordered by label. The rows always add up to `transferTotal`.
 */
export function transferByAccount(payments: readonly AccountedPayment[]): TransferAccountTotal[] {
  const rows = new Map<string | null, TransferAccountTotal>();

  for (const payment of payments) {
    if (payment.method !== 'TRANSFER') continue;

    const id = payment.bankAccount?.id ?? null;
    const row = rows.get(id);

    if (row !== undefined) {
      row.total += payment.amount;
      continue;
    }

    rows.set(id, {
      bankAccountId: id,
      label:
        payment.bankAccount === null ? NO_ACCOUNT_LABEL : bankAccountLabel(payment.bankAccount),
      total: payment.amount,
    });
  }

  return [...rows.values()].sort((a, b) => {
    if (a.bankAccountId === null) return 1;
    if (b.bankAccountId === null) return -1;

    return a.label.localeCompare(b.label, 'es');
  });
}

/** Lavados distintos entre los pagos del turno (112): ventas y cuentas no cuentan. */
export function washCount(payments: readonly { workOrderId: string | null }[]): number {
  return new Set(
    payments.flatMap((payment) => (payment.workOrderId === null ? [] : [payment.workOrderId])),
  ).size;
}
