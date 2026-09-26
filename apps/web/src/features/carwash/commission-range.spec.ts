import { presetRange } from '@/lib/civil-date';
import { commissionRangeFrom, commissionRangeQuery } from './commission-range';

describe('commissionRangeFrom (061)', () => {
  it('usa el rango de la URL cuando es válido', () => {
    expect(commissionRangeFrom('2026-08-01', '2026-08-31')).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
    });
  });

  it('sin parámetros cae al mes en curso', () => {
    expect(commissionRangeFrom(undefined, undefined)).toEqual(presetRange('month'));
  });

  it('descarta fechas inválidas, repetidas o al revés', () => {
    const month = presetRange('month');

    expect(commissionRangeFrom('2026-02-30', '2026-03-01')).toEqual(month);
    expect(commissionRangeFrom(['2026-08-01'], '2026-08-31')).toEqual(month);
    expect(commissionRangeFrom('2026-08-31', '2026-08-01')).toEqual(month);
  });
});

describe('commissionRangeQuery (061)', () => {
  it('escribe start y end, nunca from', () => {
    expect(commissionRangeQuery({ from: '2026-09-01', to: '2026-09-26' })).toBe(
      'start=2026-09-01&end=2026-09-26',
    );
  });
});
