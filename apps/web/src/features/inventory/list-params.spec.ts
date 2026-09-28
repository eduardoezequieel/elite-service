import { ALL_FILTER } from '@/lib/list-filters';

import {
  DEFAULT_INVENTORY_LIST,
  inventoryListFrom,
  inventoryListQuery,
  movementsApiQuery,
  movementsFilterFrom,
  movementsFilterQuery,
} from './list-params';

const ITEM = '0b8a4a8e-4d2e-4f55-9d57-4a1d2b1c9e01';
const EMPLOYEE = '5f0c1d2e-3a4b-4c5d-8e6f-7a8b9c0d1e2f';

describe('lista de inventario en la URL', () => {
  it('una URL limpia es la pestaña de productos sin filtros', () => {
    expect(inventoryListFrom({})).toEqual(DEFAULT_INVENTORY_LIST);
    expect(inventoryListQuery(DEFAULT_INVENTORY_LIST)).toBe('');
  });

  it('va y vuelve con pestaña, búsqueda, bajo mínimo, inactivos y página', () => {
    const state = {
      kind: 'SUPPLY' as const,
      search: 'franela',
      lowStock: true,
      includeInactive: true,
      categoryId: ITEM,
      page: 2,
    };
    const query = inventoryListQuery(state);

    expect(query).toBe(`kind=SUPPLY&q=franela&low=1&inactive=1&cat=${ITEM}&page=2`);
    expect(inventoryListFrom(Object.fromEntries(new URLSearchParams(query)))).toEqual(state);
  });

  it('descarta lo que no escribió esta app', () => {
    expect(inventoryListFrom({ kind: 'OTRO', page: '-3', low: 'si' })).toEqual(
      DEFAULT_INVENTORY_LIST,
    );
  });
});

describe('reporte de movimientos en la URL', () => {
  it('arranca en el mes en curso y sin recortes', () => {
    const state = movementsFilterFrom({}, '2026-09-26');

    expect(state).toEqual({
      type: ALL_FILTER,
      itemId: ALL_FILTER,
      employeeId: ALL_FILTER,
      range: { from: '2026-09-01', to: '2026-09-26' },
      page: 1,
    });
    expect(movementsApiQuery(state)).toEqual({ from: '2026-09-01', to: '2026-09-26', page: 1 });
  });

  it('va y vuelve con todos los filtros puestos', () => {
    const state = {
      type: 'DISPATCH',
      itemId: ITEM,
      employeeId: EMPLOYEE,
      range: { from: '2026-09-10', to: '2026-09-20' },
      page: 3,
    };
    const query = movementsFilterQuery(state);

    expect(movementsFilterFrom(Object.fromEntries(new URLSearchParams(query)))).toEqual(state);
    expect(movementsApiQuery(state)).toEqual({
      type: 'DISPATCH',
      itemId: ITEM,
      employeeId: EMPLOYEE,
      from: '2026-09-10',
      to: '2026-09-20',
      page: 3,
    });
  });

  it('un tipo, un id o un rango inválidos vuelven al valor por defecto', () => {
    const state = movementsFilterFrom(
      { type: 'ROBO', item: 'abc', employee: '1', start: '2026-09-20', end: '2026-09-01' },
      '2026-09-26',
    );

    expect(state.type).toBe(ALL_FILTER);
    expect(state.itemId).toBe(ALL_FILTER);
    expect(state.employeeId).toBe(ALL_FILTER);
    expect(state.range).toEqual({ from: '2026-09-01', to: '2026-09-26' });
  });

  it('un chip pide su grupo de tipos y una URL vieja cae en su grupo (091)', () => {
    const sales = movementsFilterFrom({ type: 'SALE_RETURN' }, '2026-09-26');

    expect(sales.type).toBe('SALE');
    expect(movementsApiQuery(sales).type).toBe('SALE,SALE_RETURN');
    expect(movementsApiQuery({ ...sales, type: 'CONSUMPTION' }).type).toBe(
      'CONSUMPTION,CONSUMPTION_RETURN',
    );
  });
});
