import {
  historyFilter,
  historyMonth,
  historyQuery,
  monthBounds,
  monthTitle,
  shiftMonth,
} from './agreement-history';

describe('Historial de rentas (117)', () => {
  const TODAY = '2026-10-19';

  it('arranca en el mes actual y no pasa de él', () => {
    expect(historyMonth(null, TODAY)).toBe('2026-10');
    expect(historyMonth('2026-09', TODAY)).toBe('2026-09');
    expect(historyMonth('2026-11', TODAY)).toBe('2026-10');
    expect(historyMonth('2026-13', TODAY)).toBe('2026-10');
    expect(historyMonth('raro', TODAY)).toBe('2026-10');
  });

  it('se mueve de mes en mes, cruzando el año', () => {
    expect(shiftMonth('2026-10', -1)).toBe('2026-09');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2025-12', 1)).toBe('2026-01');
  });

  it('el mes va del primer al último día', () => {
    expect(monthBounds('2026-09')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(monthBounds('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(monthBounds('2026-12')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it('nombra el mes en minúscula, con el año', () => {
    expect(monthTitle('2026-09')).toBe('septiembre 2026');
  });

  it('el filtro arranca en «Todas»', () => {
    expect(historyFilter(null)).toBe('ALL');
    expect(historyFilter('CANCELLED')).toBe('CANCELLED');
    expect(historyFilter('RESERVED')).toBe('ALL');
  });

  it('pide solo cerradas y canceladas, del mes', () => {
    expect(historyQuery({ filter: 'ALL', month: '2026-09', vehicleId: null, search: '' })).toEqual({
      status: ['FINISHED', 'CANCELLED'],
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(
      historyQuery({ filter: 'CANCELLED', month: '2026-09', vehicleId: 'v1', search: '' }),
    ).toEqual({ status: ['CANCELLED'], from: '2026-09-01', to: '2026-09-30', vehicleId: 'v1' });
  });

  it('con texto en el buscador, ignora el mes', () => {
    expect(
      historyQuery({ filter: 'FINISHED', month: '2026-09', vehicleId: null, search: 'P123' }),
    ).toEqual({ status: ['FINISHED'], q: 'P123' });
  });
});
