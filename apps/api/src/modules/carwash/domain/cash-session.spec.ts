import { closeSnapshot, differenceCash, expectedCash, paymentTotals } from './cash-session';

describe('cash-session arithmetic', () => {
  const cash14 = { method: 'CASH' as const, amount: 1400 };
  const card10 = { method: 'CARD' as const, amount: 1000 };
  const transfer5 = { method: 'TRANSFER' as const, amount: 500 };

  it('sums each method and ignores card/transfer in expected cash', () => {
    const totals = paymentTotals([cash14, card10, transfer5]);

    expect(totals).toEqual({ cashTotal: 1400, cardTotal: 1000, transferTotal: 500 });
    expect(expectedCash(2000, totals.cashTotal)).toBe(3400);
  });

  it('expected cash is float plus cash charges only (RN-4)', () => {
    expect(expectedCash(2000, 1400)).toBe(3400);
    expect(expectedCash(0, 0)).toBe(0);
  });

  it('difference is counted minus expected, in cents', () => {
    expect(differenceCash(3400, 3400)).toBe(0);
    expect(differenceCash(3300, 3400)).toBe(-100);
    expect(differenceCash(3500, 3400)).toBe(100);
  });

  it('close snapshot: float 20 + cash 14 + card 10, counted 34 → difference 0', () => {
    expect(closeSnapshot(2000, [cash14, card10], 3400)).toEqual({
      cashTotal: 1400,
      cardTotal: 1000,
      transferTotal: 0,
      expectedCash: 3400,
      differenceCash: 0,
    });
  });

  it('close snapshot: same drawer counted 33 → shortage of 1.00', () => {
    expect(closeSnapshot(2000, [cash14, card10], 3300).differenceCash).toBe(-100);
  });
});
