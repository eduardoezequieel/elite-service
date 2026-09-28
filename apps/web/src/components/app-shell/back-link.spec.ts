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

  it('un lavado abierto desde Rendimiento vuelve con la misma pestaña, empleado y rango (067)', () => {
    const origin = '/carwash/performance?tab=times&employee=e1&start=2026-09-01&end=2026-09-26';

    expect(backLinkFor('/carwash/performance')).toBeNull();
    expect(backLinkFor('/carwash/abc', origin)).toEqual({ href: origin, label: 'Rendimiento' });
    expect(withBackTo('/carwash/abc', origin)).toBe(
      `/carwash/abc?${BACK_PARAM}=${encodeURIComponent(origin)}`,
    );
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

describe('inventario (065)', () => {
  it('la ficha de un artículo vuelve al inventario, o a la pantalla de la que se entró', () => {
    expect(backLinkFor('/inventory/i1')).toEqual({ href: '/inventory', label: 'Inventario' });
    expect(backLinkFor('/inventory/i1', '/inventory/movements?type=DISPATCH')?.label).toBe(
      'Movimientos',
    );
  });

  it('un lavado abierto desde el kardex vuelve al artículo', () => {
    expect(backLinkFor('/carwash/t1', '/inventory/i1')).toEqual({
      href: '/inventory/i1',
      label: 'Artículo',
    });
  });
});

describe('categorías del inventario fuera del riel (068)', () => {
  it('vuelven a Catálogo, en la pestaña de la que se salió', () => {
    expect(backLinkFor('/settings/inventory/categories')).toEqual({
      href: '/settings/catalog?tab=products',
      label: 'Catálogo',
    });
    expect(backLinkFor('/settings/inventory/categories', '/settings/catalog?tab=supplies')).toEqual(
      { href: '/settings/catalog?tab=supplies', label: 'Catálogo' },
    );
  });

  it('el botón anota el origen solo si no es el regreso de siempre', () => {
    expect(withBackTo('/settings/inventory/categories', '/settings/catalog?tab=products')).toBe(
      '/settings/inventory/categories',
    );
    expect(withBackTo('/settings/inventory/categories', '/settings/catalog?tab=supplies')).toBe(
      '/settings/inventory/categories?from=%2Fsettings%2Fcatalog%3Ftab%3Dsupplies',
    );
  });

  it('un artículo abierto desde Catálogo vuelve a Catálogo', () => {
    expect(backLinkFor('/inventory/i1', '/settings/catalog?tab=supplies')).toEqual({
      href: '/settings/catalog?tab=supplies',
      label: 'Catálogo',
    });
  });
});

describe('consumo de empleados (070)', () => {
  it('el reporte vuelve al inventario', () => {
    expect(backLinkFor('/inventory/consumption')).toEqual({
      href: '/inventory',
      label: 'Inventario',
    });
  });

  it('el detalle de un trabajador vuelve al reporte, no al inventario', () => {
    expect(backLinkFor('/inventory/consumption/e1')).toEqual({
      href: '/inventory/consumption',
      label: 'Consumo de empleados',
    });
  });

  it('la fila anota el mes y el regreso lo conserva', () => {
    const href = withBackTo(
      '/inventory/consumption/e1?month=2026-08',
      '/inventory/consumption?month=2026-08',
    );

    expect(href).toBe(
      '/inventory/consumption/e1?month=2026-08&from=%2Finventory%2Fconsumption%3Fmonth%3D2026-08',
    );
    const origin = '/inventory/consumption?month=2026-08';

    expect(backLinkFor('/inventory/consumption/e1', origin)).toEqual({
      href: origin,
      label: 'Consumo de empleados',
    });
  });

  it('el reporte no se confunde con la ficha de un artículo', () => {
    expect(labelFor('/inventory/consumption')).toBe('Consumo de empleados');
    expect(labelFor('/inventory/i1')).toBe('Artículo');
  });
});
