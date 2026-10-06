import type { VehicleMonthRow } from '@elite/shared';

import {
  matchingProfitabilityPreset,
  monthBarsScale,
  monthLong,
  monthShort,
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
    occupancy: 0,
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
      to: '2026-10-31',
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
      matchingProfitabilityPreset({ from: '2026-09-01', to: '2026-09-30' }, '2026-10-20'),
    ).toBe('lastMonth');
    expect(
      matchingProfitabilityPreset({ from: '2026-09-02', to: '2026-09-30' }, '2026-10-20'),
    ).toBeNull();
  });

  it('nombres de mes', () => {
    expect(monthShort('2026-10')).toBe('oct');
    expect(monthLong('2026-01')).toBe('Enero 2026');
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
