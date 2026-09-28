import { consumptionByEmployee, consumptionTotals, consumptionValue } from './consumption';
import type { ConsumptionFigures } from './consumption';

function entry(
  employeeId: string,
  quantity: number,
  unitPrice: number,
  reversed = false,
): ConsumptionFigures {
  return { employeeId, employeeName: employeeId, quantity, unitPrice, reversed };
}

describe('consumptionValue', () => {
  it('2 × $1.25 = $2.50', () => {
    expect(consumptionValue(2000, 125)).toBe(250);
  });

  it('redondea al centavo, mitad hacia arriba', () => {
    // 0.5 × $0.75 = $0.375 → $0.38
    expect(consumptionValue(500, 75)).toBe(38);
  });

  it('usa la cantidad sin signo', () => {
    expect(consumptionValue(-2000, 125)).toBe(250);
  });
});

describe('consumptionTotals', () => {
  it('no cuenta los anulados', () => {
    expect(consumptionTotals([entry('juan', 2000, 125), entry('juan', 1000, 75, true)])).toEqual({
      units: 2000,
      total: 250,
    });
  });
});

describe('consumptionByEmployee', () => {
  it('el ejemplo de la spec: Juan 3 / $3.25, Ana 1 / $1.25, total $4.50', () => {
    const report = consumptionByEmployee([
      entry('ana', 1000, 125),
      entry('juan', 2000, 125),
      entry('juan', 1000, 75),
    ]);

    expect(report.rows).toEqual([
      { employeeId: 'juan', units: 3000, total: 325 },
      { employeeId: 'ana', units: 1000, total: 125 },
    ]);
    expect(report.total).toBe(450);
  });

  it('quien solo tiene anulados no sale', () => {
    const report = consumptionByEmployee([entry('ana', 1000, 125, true), entry('juan', 1000, 75)]);

    expect(report.rows.map((row) => row.employeeId)).toEqual(['juan']);
    expect(report.total).toBe(75);
  });

  it('a igual valor, más unidades primero y después por nombre', () => {
    const report = consumptionByEmployee([
      { ...entry('b', 1000, 100), employeeName: 'Beto' },
      { ...entry('a', 1000, 100), employeeName: 'Ana' },
      { ...entry('c', 2000, 50), employeeName: 'Carla' },
    ]);

    expect(report.rows.map((row) => row.employeeId)).toEqual(['c', 'a', 'b']);
  });
});
