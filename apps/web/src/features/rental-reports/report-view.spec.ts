import type { VehicleMonthRow } from '@elite/shared';

import {
  matchingProfitabilityPreset,
  monthBarsScale,
  monthCutoffLabel,
  monthDetailLine,
  monthLong,
  monthName,
  monthShort,
  rentedDaysLabel,
  percentLabel,
  profitabilityRange,
  recoveredLabel,
  signedMoney,
} from './report-view';

function row(month: string, net: string, future = false): VehicleMonthRow {
  return {
    month,
    income: '0.00',
    expenses: '0.00',
    fixed: '0.00',
    installment: '0.00',
    operating: net,
    net,
    verdict: 'NONE',
    rentedDays: 0,
    future,
  };
}

describe('report-view (100)', () => {
  it('formatea dinero con signo, porcentajes y lo recuperado', () => {
    expect(signedMoney('-40.00')).toBe('-$40.00');
    expect(signedMoney('12.50')).toBe('$12.50');
    expect(percentLabel(0.456)).toBe('46 %');
    expect(recoveredLabel({ recovered: null })).toBe('Faltan datos');
    expect(recoveredLabel({ recovered: 1 })).toBe('Ya se pagó solo');
    expect(recoveredLabel({ recovered: 0.375 })).toBe('38 %');
    expect(recoveredLabel({ recovered: -0.2 })).toBe('0 %');
  });

  it('presets de periodo en meses enteros', () => {
    expect(profitabilityRange('month', '2026-10-20')).toEqual({
      from: '2026-10-01',
      to: '2026-10-20',
    });
    expect(profitabilityRange('lastMonth', '2026-10-20')).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(profitabilityRange('quarter', '2026-10-20')).toEqual({
      from: '2026-08-01',
      to: '2026-10-31',
    });
    expect(profitabilityRange('year', '2026-10-20')).toEqual({
      from: '2026-01-01',
      to: '2026-12-31',
    });
    expect(
      matchingProfitabilityPreset({ from: '2026-10-01', to: '2026-10-20' }, '2026-10-20'),
    ).toBe('month');
    expect(
      matchingProfitabilityPreset({ from: '2026-09-01', to: '2026-09-30' }, '2026-10-20'),
    ).toBe('lastMonth');
    expect(
      matchingProfitabilityPreset({ from: '2026-09-02', to: '2026-09-30' }, '2026-10-20'),
    ).toBeNull();
  });

  it('nombres de mes', () => {
    expect(monthShort('2026-10')).toBe('oct');
    expect(monthName('2026-01')).toBe('Enero');
    expect(monthLong('2026-01')).toBe('Enero 2026');
  });

  it('el mes abierto dice los días y, si es el de hoy, hasta qué día', () => {
    expect(rentedDaysLabel(1)).toBe('1 día rentado');
    expect(rentedDaysLabel(8)).toBe('8 días rentados');
    expect(rentedDaysLabel(1.5)).toBe('1.5 días rentados');
    expect(monthCutoffLabel('2026-10', '2026-10-11')).toBe('hasta el 11 de octubre');
    expect(monthCutoffLabel('2026-09', '2026-10-11')).toBeNull();
    expect(
      monthDetailLine(
        { month: '2026-10', rentedDays: 8, future: false, verdict: 'GAIN' },
        '2026-10-11',
      ),
    ).toBe('8 días rentados · hasta el 11 de octubre');
    expect(
      monthDetailLine(
        { month: '2026-03', rentedDays: 9, future: false, verdict: 'LOSS' },
        '2026-10-11',
      ),
    ).toBe('9 días rentados');
    expect(
      monthDetailLine(
        { month: '2026-11', rentedDays: 0, future: true, verdict: 'NONE' },
        '2026-10-11',
      ),
    ).toBeNull();
    expect(
      monthDetailLine(
        { month: '2026-01', rentedDays: 0, future: false, verdict: 'NONE' },
        '2026-10-11',
      ),
    ).toBeNull();
  });

  it('la escala de la gráfica deja el cero donde caben las pérdidas', () => {
    const scale = monthBarsScale([
      row('2026-01', '300.00'),
      row('2026-02', '-100.00'),
      row('2026-03', '0.00', true),
    ]);

    expect(scale.upShare).toBeCloseTo(0.75, 6);
    expect(scale.bars[0]?.ratio).toBeCloseTo(30000 / (40000 * 1.08), 6);
    expect(scale.bars[1]?.ratio).toBeLessThan(0);
    expect(monthBarsScale([row('2026-01', '0.00')]).upShare).toBe(1);
  });
});
