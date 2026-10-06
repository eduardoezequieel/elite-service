import type { PaymentMethod } from '@elite/shared';

/** Sumas de un turno, en centavos. `OTHER` no es efectivo (109 RN-3). */
export interface MethodTotals {
  cashTotal: number;
  cardTotal: number;
  transferTotal: number;
  otherTotal: number;
}

export function methodTotals(
  payments: readonly { method: PaymentMethod; amount: number }[],
): MethodTotals {
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

/** Fondo más efectivo cobrado. Tarjeta, transferencia y «Otro» no entran. */
export function expectedCash(openingFloat: number, cashTotal: number): number {
  return openingFloat + cashTotal;
}

/** Contado menos esperado. Negativo es falta; positivo es sobra. */
export function differenceCash(countedCash: number, expected: number): number {
  return countedCash - expected;
}
