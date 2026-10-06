import { differenceCash, expectedCash, methodTotals } from './cash-shift';

describe('methodTotals (109 RN-3)', () => {
  it('separa los cuatro métodos y deja «Otro» fuera del efectivo esperado', () => {
    const totals = methodTotals([
      { method: 'CASH', amount: 3000 },
      { method: 'CARD', amount: 1000 },
      { method: 'TRANSFER', amount: 400 },
      { method: 'OTHER', amount: 500 },
    ]);

    expect(totals).toEqual({
      cashTotal: 3000,
      cardTotal: 1000,
      transferTotal: 400,
      otherTotal: 500,
    });
    expect(expectedCash(2000, totals.cashTotal)).toBe(5000);
    expect(differenceCash(4800, 5000)).toBe(-200);
  });
});
