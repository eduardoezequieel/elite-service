import { salesDateFrom, salesListQuery, salesSectionFor } from './list-params';

describe('la lista de ventas en la URL (056, 082)', () => {
  it('lee solo un día válido', () => {
    expect(salesDateFrom('2026-09-27')).toBe('2026-09-27');
    expect(salesDateFrom('2026-02-30')).toBeNull();
    expect(salesDateFrom(['2026-09-27'])).toBeNull();
    expect(salesDateFrom(null)).toBeNull();
  });

  it('escribe el día siempre', () => {
    expect(salesListQuery('2026-09-27')).toBe('date=2026-09-27');
  });
});

describe('las pestañas de Ventas (106)', () => {
  it('la pestaña sale de la ruta', () => {
    expect(salesSectionFor('/sales')).toBe('day');
    expect(salesSectionFor('/sales/tabs')).toBe('tabs');
  });
});
