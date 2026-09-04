import {
  buildCommissionReport,
  commissionFor,
  resolveCommissionRange,
  splitCommission,
} from './commission';

describe('commissionFor (009 RN-2)', () => {
  it.each([
    [0, 0],
    [100, 0],
    [799, 0],
    [800, 0],
    [1399, 0],
    [1400, 100],
    [1499, 100],
    [1999, 100],
    [2000, 200],
    [2499, 200],
    [2500, 300],
    [3499, 300],
    [3500, 400],
    [3999, 400],
    [4000, 480],
    [5000, 600],
  ])('%i centavos → %i de comisión', (total, commission) => {
    expect(commissionFor(total)).toBe(commission);
  });

  it('el salto $39.99 → $4 / $40 → $4.80 se copia a propósito', () => {
    expect(commissionFor(3999)).toBe(400);
    expect(commissionFor(4000)).toBe(480);
  });

  it('el 12 % redondea al centavo más cercano', () => {
    // 4166 × 12 / 100 = 499.92 → 500
    expect(commissionFor(4166)).toBe(500);
    // 4162 × 12 / 100 = 499.44 → 499
    expect(commissionFor(4162)).toBe(499);
  });
});

describe('splitCommission (009 RN-4)', () => {
  it('sin lavadores no hay partes', () => {
    expect(splitCommission(100, 0)).toEqual([]);
  });

  it('un lavador se lleva el total', () => {
    expect(splitCommission(100, 1)).toEqual([100]);
    expect(splitCommission(0, 1)).toEqual([0]);
  });

  it('$14 con 2 lavadores → 0.50 / 0.50', () => {
    expect(splitCommission(100, 2)).toEqual([50, 50]);
  });

  it('$1.00 / 3 lavadores suma 1.00 (resto al último)', () => {
    const parts = splitCommission(100, 3);

    expect(parts).toEqual([33, 33, 34]);
    expect(parts.reduce((sum, part) => sum + part, 0)).toBe(100);
  });

  it('un centavo impar se va al último', () => {
    expect(splitCommission(1, 2)).toEqual([0, 1]);
  });
});

describe('resolveCommissionRange', () => {
  it('sin fechas usa hoy–hoy en formato civil', () => {
    const range = resolveCommissionRange();

    expect(range.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(range.to).toBe(range.from);
  });

  it('completa el lado que falte con hoy', () => {
    expect(resolveCommissionRange('2026-01-01').from).toBe('2026-01-01');
    expect(resolveCommissionRange(undefined, '2026-01-02').to).toBe('2026-01-02');
  });
});

describe('buildCommissionReport', () => {
  it('agrupa por empleado, ordena comisión desc y nombre asc, y no mete unassigned a pagar', () => {
    const report = buildCommissionReport(
      { from: '2026-09-01', to: '2026-09-03' },
      [
        {
          employeeId: 'jose',
          fullName: 'José VIS',
          isActive: true,
          amount: 50,
          workOrderId: 't1',
          ticketTotal: 1400,
          washerCount: 2,
          washerIndex: 1,
        },
        {
          employeeId: 'carlos',
          fullName: 'Carlos VIS',
          isActive: false,
          amount: 50,
          workOrderId: 't1',
          ticketTotal: 1400,
          washerCount: 2,
          washerIndex: 0,
        },
        {
          employeeId: 'carlos',
          fullName: 'Carlos VIS',
          isActive: false,
          amount: 100,
          workOrderId: 't2',
          ticketTotal: 1400,
          washerCount: 1,
          washerIndex: 0,
        },
      ],
      [{ commissionTotal: 100 }],
    );

    expect(report.from).toBe('2026-09-01');
    expect(report.to).toBe('2026-09-03');
    expect(report.employees.map((row) => row.employeeId)).toEqual(['carlos', 'jose']);
    expect(report.employees[0]).toMatchObject({
      fullName: 'Carlos VIS',
      isActive: false,
      ticketCount: 2,
      commission: '1.50',
      salesAttributed: '21.00',
    });
    expect(report.employees[1]).toMatchObject({
      ticketCount: 1,
      commission: '0.50',
      salesAttributed: '7.00',
    });
    expect(report.unassigned).toEqual({ ticketCount: 1, commission: '1.00' });
    expect(report.totalPayable).toBe('2.00');
  });

  it('no lista a quien no tiene tickets ni comisión', () => {
    const report = buildCommissionReport({ from: '2026-09-01', to: '2026-09-01' }, [], []);

    expect(report.employees).toEqual([]);
    expect(report.totalPayable).toBe('0.00');
    expect(report.unassigned).toEqual({ ticketCount: 0, commission: '0.00' });
  });
});
