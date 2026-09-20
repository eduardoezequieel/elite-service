import { BACK_PARAM, backLinkFor, labelFor, safeOrigin, withBackTo } from './back-link';

describe('backLinkFor', () => {
  it('no dibuja regreso en una pantalla de primer nivel', () => {
    expect(backLinkFor('/carwash')).toBeNull();
    expect(backLinkFor('/carwash/cash')).toBeNull();
    expect(backLinkFor('/floor')).toBeNull();
  });

  it('sube al padre estructural cuando no hay origen', () => {
    expect(backLinkFor('/carwash/abc')).toEqual({ href: '/carwash', label: 'Lavados' });
    expect(backLinkFor('/carwash/cash/abc')).toEqual({ href: '/carwash/cash', label: 'Caja' });
    expect(backLinkFor('/customers/abc')).toEqual({ href: '/customers', label: 'Clientes' });
    expect(backLinkFor('/floor/abc')).toEqual({ href: '/floor', label: 'Lavados activos' });
  });

  it('vuelve al origen cuando la URL lo trae', () => {
    expect(backLinkFor('/carwash/abc', '/carwash/cash')).toEqual({
      href: '/carwash/cash',
      label: 'Caja',
    });
  });

  it('nombra la pantalla de origen, no su módulo', () => {
    expect(backLinkFor('/carwash/abc', '/carwash/cash/s1')?.label).toBe('Turno');
    expect(backLinkFor('/carwash/abc', '/customers/c1')?.label).toBe('Cliente');
  });

  it('conserva los filtros del origen', () => {
    expect(backLinkFor('/carwash/abc', '/carwash?date=2026-09-19&q=abc')).toEqual({
      href: '/carwash?date=2026-09-19&q=abc',
      label: 'Lavados',
    });
  });

  it('descarta un origen en el que no se puede confiar', () => {
    const structural = { href: '/carwash', label: 'Lavados' };

    expect(backLinkFor('/carwash/abc', '//evil.com')).toEqual(structural);
    expect(backLinkFor('/carwash/abc', '/\\evil.com')).toEqual(structural);
    expect(backLinkFor('/carwash/abc', 'https://evil.com')).toEqual(structural);
    expect(backLinkFor('/carwash/abc', '/../etc/passwd')).toEqual(structural);
    expect(backLinkFor('/carwash/abc', '/desconocido')).toEqual(structural);
    expect(backLinkFor('/carwash/abc', `/carwash/${'x'.repeat(600)}`)).toEqual(structural);
    expect(backLinkFor('/carwash/abc', '')).toEqual(structural);
    expect(backLinkFor('/carwash/abc', null)).toEqual(structural);
  });

  it('descarta un origen que es la pantalla actual', () => {
    expect(backLinkFor('/carwash/abc', '/carwash/abc')).toEqual({
      href: '/carwash',
      label: 'Lavados',
    });
  });

  it('no dibuja regreso en primer nivel aunque le cuelguen un origen', () => {
    expect(backLinkFor('/carwash', '/carwash/cash')).toBeNull();
  });
});

describe('withBackTo', () => {
  it('no ensucia la URL cuando el regreso estructural ya lleva al origen', () => {
    expect(withBackTo('/carwash/abc', '/carwash')).toBe('/carwash/abc');
    expect(withBackTo('/floor/abc', '/floor')).toBe('/floor/abc');
  });

  it('anota el origen cuando se entra de costado', () => {
    expect(withBackTo('/carwash/abc', '/carwash/cash')).toBe(
      `/carwash/abc?${BACK_PARAM}=${encodeURIComponent('/carwash/cash')}`,
    );
  });

  it('anota los filtros del origen', () => {
    expect(withBackTo('/carwash/abc', '/carwash?date=2026-09-19')).toBe(
      `/carwash/abc?${BACK_PARAM}=${encodeURIComponent('/carwash?date=2026-09-19')}`,
    );
  });

  it('deja el destino intacto si el origen no es de fiar o es el destino mismo', () => {
    expect(withBackTo('/carwash/abc', 'https://evil.com')).toBe('/carwash/abc');
    expect(withBackTo('/carwash/abc', '/carwash/abc')).toBe('/carwash/abc');
  });

  it('no anota nada en un destino de primer nivel', () => {
    expect(withBackTo('/carwash', '/customers')).toBe('/carwash');
  });
});

describe('safeOrigin y labelFor', () => {
  it('acepta una ruta interna de una raíz conocida', () => {
    expect(safeOrigin('/carwash/cash', '/carwash/abc')).toBe('/carwash/cash');
  });

  it('nombra raíces, detalles y, en el peor caso, el módulo', () => {
    expect(labelFor('/carwash/cash')).toBe('Caja');
    expect(labelFor('/carwash/cash/s1')).toBe('Turno');
    expect(labelFor('/customers/c1')).toBe('Cliente');
    expect(labelFor('/carwash/t1')).toBe('Lavado');
    expect(labelFor('/settings/catalog/categories')).toBe('Catálogo');
  });
});
