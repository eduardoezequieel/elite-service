import type { Cents } from './money';

export type CashMethod = 'CASH' | 'CARD' | 'TRANSFER';

export interface CashPaymentAmount {
  method: CashMethod;
  amount: Cents;
}

export interface MethodTotals {
  cashTotal: Cents;
  cardTotal: Cents;
  transferTotal: Cents;
}

export interface CloseSnapshot extends MethodTotals {
  expectedCash: Cents;
  differenceCash: Cents;
}

/** Sum each payment method. Card and transfer are reported, never mixed into cash. */
export function paymentTotals(payments: readonly CashPaymentAmount[]): MethodTotals {
  let cashTotal = 0;
  let cardTotal = 0;
  let transferTotal = 0;

  for (const payment of payments) {
    if (payment.method === 'CASH') cashTotal += payment.amount;
    else if (payment.method === 'CARD') cardTotal += payment.amount;
    else transferTotal += payment.amount;
  }

  return { cashTotal, cardTotal, transferTotal };
}

/** Expected drawer contents: float already in the till plus CASH charges. */
export function expectedCash(openingFloat: Cents, cashTotal: Cents): Cents {
  return openingFloat + cashTotal;
}

/** Counted minus expected. Negative is a shortage; positive is an overage. */
export function differenceCash(countedCash: Cents, expected: Cents): Cents {
  return countedCash - expected;
}

/** Frozen totals written on close. Card/transfer do not change expected cash. */
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
