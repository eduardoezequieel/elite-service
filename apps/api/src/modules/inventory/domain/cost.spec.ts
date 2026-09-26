import { fromMoneyString, toMoneyString, weightedAverageCost } from './cost';

describe('dinero en centavos', () => {
  it('ida y vuelta', () => {
    expect(fromMoneyString('14.5')).toBe(1450);
    expect(fromMoneyString('3')).toBe(300);
    expect(toMoneyString(1450)).toBe('14.50');
    expect(toMoneyString(5)).toBe('0.05');
  });

  it('rechaza tres decimales', () => {
    expect(() => fromMoneyString('1.234')).toThrow();
  });
});

describe('weightedAverageCost (RN-11)', () => {
  it('sin existencia previa el promedio es el costo de la entrada', () => {
    expect(weightedAverageCost(0, 0, 3000, 250)).toBe(250);
  });

  it('pondera con la existencia previa', () => {
    // 10 a $2.00 + 10 a $3.00 = 20 a $2.50
    expect(weightedAverageCost(10000, 200, 10000, 300)).toBe(250);
  });

  it('redondea al centavo, mitad hacia arriba', () => {
    // (1 × 1.00 + 2 × 1.01) / 3 = 1.00666… → 1.01
    expect(weightedAverageCost(1000, 100, 2000, 101)).toBe(101);
    // (1 × 1.00 + 1 × 1.01) / 2 = 1.005 → 1.01
    expect(weightedAverageCost(1000, 100, 1000, 101)).toBe(101);
    // (3 × 1.00 + 1 × 1.01) / 4 = 1.0025 → 1.00
    expect(weightedAverageCost(3000, 100, 1000, 101)).toBe(100);
  });

  it('con fracciones de cantidad', () => {
    // 0.5 L a $4.00 + 1.5 L a $6.00 = 2 L a $5.50
    expect(weightedAverageCost(500, 400, 1500, 600)).toBe(550);
  });

  it('un saldo bajo cero no pondera', () => {
    expect(weightedAverageCost(-1000, 900, 2000, 300)).toBe(300);
  });

  it('no calcula sin cantidad', () => {
    expect(() => weightedAverageCost(1000, 100, 0, 100)).toThrow();
  });

  it('no se desborda con cifras grandes', () => {
    expect(weightedAverageCost(99_999_999, 9_999_999, 99_999_999, 9_999_999)).toBe(9_999_999);
  });
});
