import {
  ALL_DAYS,
  EMPTY_FILTER,
  countOfKind,
  dayLabelOf,
  filterNotifications,
  groupByDay,
  matchesQuery,
  visibleKinds,
} from './filters';
import type { Notification } from './notification';
import { dayKeyOf } from './store';

/**
 * Las fechas se arman en hora local, no en UTC: el dia de la bandeja es el del
 * aparato, asi que un instante escrito en `Z` haria pasar o fallar el test
 * segun el huso de quien lo corre.
 */
function at(day: number, hour: number): string {
  return new Date(2026, 8, day, hour, 0, 0).toISOString();
}

const NOW = new Date(2026, 8, 20, 15, 0, 0);

function notification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n-1',
    title: 'Entró #7',
    description: 'P052-201',
    by: 'Carlos · pista',
    tone: 'neutral',
    kind: 'in',
    href: '/carwash/t-1',
    at: at(20, 12),
    read: false,
    ...overrides,
  };
}

describe('matchesQuery', () => {
  const item = notification();

  it('sin texto no recorta nada', () => {
    expect(matchesQuery(item, '   ')).toBe(true);
  });

  it('busca por placa, sin importar mayúsculas', () => {
    expect(matchesQuery(item, 'p052')).toBe(true);
    expect(matchesQuery(item, 'M188')).toBe(false);
  });

  it('busca por el número del lavado, con almohadilla o sin ella', () => {
    expect(matchesQuery(item, '#7')).toBe(true);
    expect(matchesQuery(item, '7')).toBe(true);
  });
});

describe('filterNotifications', () => {
  const today = notification({ id: 'hoy' });
  const yesterday = notification({
    id: 'ayer',
    at: at(19, 12),
    kind: 'cash',
    title: 'Se cobró #5',
    description: 'M188-004 · $12.00',
    read: true,
  });

  const list = [today, yesterday];

  it('sin filtro devuelve todo', () => {
    expect(filterNotifications(list, EMPTY_FILTER)).toHaveLength(2);
  });

  it('recorta por día', () => {
    const only = filterNotifications(list, {
      ...EMPTY_FILTER,
      day: dayKeyOf(at(19, 12)),
    });

    expect(only.map((item) => item.id)).toEqual(['ayer']);
  });

  it('recorta por tipo', () => {
    expect(filterNotifications(list, { ...EMPTY_FILTER, kind: 'cash' })).toHaveLength(1);
  });

  it('recorta por sin leer', () => {
    const pending = filterNotifications(list, { ...EMPTY_FILTER, unreadOnly: true });

    expect(pending.map((item) => item.id)).toEqual(['hoy']);
  });

  it('los recortes se suman', () => {
    expect(
      filterNotifications(list, { ...EMPTY_FILTER, kind: 'cash', unreadOnly: true }),
    ).toHaveLength(0);
  });

  it('«todos los días» no es una clave de día', () => {
    expect(filterNotifications(list, { ...EMPTY_FILTER, day: ALL_DAYS })).toHaveLength(2);
  });
});

describe('countOfKind', () => {
  const list = [
    notification(),
    notification({ id: 'n-2', kind: 'cash' }),
    notification({ id: 'n-3', kind: 'cash' }),
  ];

  it('cuenta el tipo', () => {
    expect(countOfKind(list, 'cash')).toBe(2);
    expect(countOfKind(list, 'void')).toBe(0);
  });

  it('«todos» es el total', () => {
    expect(countOfKind(list, 'all')).toBe(3);
  });
});

describe('dayLabelOf', () => {
  it('hoy se llama «Hoy», aunque hayan pasado horas', () => {
    expect(dayLabelOf(at(20, 2), NOW).label).toBe('Hoy');
  });

  it('ayer se llama «Ayer»', () => {
    expect(dayLabelOf(at(19, 23), NOW).label).toBe('Ayer');
  });

  it('más atrás se nombra con el día de la semana', () => {
    expect(dayLabelOf(at(18, 12), NOW).label).toBe('vie 18');
  });

  it('la fecha corta va siempre: el rótulo relativo solo no ubica', () => {
    expect(dayLabelOf(at(18, 12), NOW).date).toBe('18 sep');
  });

  it('una fecha ilegible no se pinta como «Invalid Date»', () => {
    expect(dayLabelOf('no es una fecha', NOW)).toEqual({ label: 'Sin fecha', date: '' });
  });
});

describe('groupByDay', () => {
  const list = [
    notification({ id: 'a', at: at(20, 12) }),
    notification({ id: 'b', at: at(20, 9), read: true }),
    notification({ id: 'c', at: at(19, 9) }),
  ];

  it('corta por día sin reordenar la bandeja', () => {
    const groups = groupByDay(list, NOW);

    expect(groups.map((group) => group.label)).toEqual(['Hoy', 'Ayer']);
    expect(groups[0]?.items.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('cuenta los sin leer de cada día', () => {
    const groups = groupByDay(list, NOW);

    expect(groups[0]?.unread).toBe(1);
    expect(groups[1]?.unread).toBe(1);
  });
});

describe('visibleKinds', () => {
  const allowed =
    (...owned: string[]) =>
    (permission: string) =>
      owned.includes(permission);

  it('«Inventario» solo con `inventory.read`, «Cobros» solo con `carwash.cash`', () => {
    expect(visibleKinds(allowed()).map((entry) => entry.kind)).toEqual([
      'all',
      'in',
      'move',
      'void',
    ]);
    expect(
      visibleKinds(allowed('inventory.read', 'carwash.cash')).map((entry) => entry.label),
    ).toEqual(['Todos', 'Entradas', 'Avances', 'Cobros', 'Anulados', 'Inventario']);
  });
});

describe('avisos de inventario en la bandeja (065)', () => {
  const stock = notification({
    id: 's-1',
    kind: 'stock',
    title: 'Cera en pasta se está acabando',
    description: 'quedan 4 unidades (mínimo 5)',
    href: '/inventory/inv-wax',
  });
  const list = [notification(), stock];

  it('se recortan por su tipo y se cuentan', () => {
    expect(filterNotifications(list, { ...EMPTY_FILTER, kind: 'stock' })).toEqual([stock]);
    expect(countOfKind(list, 'stock')).toBe(1);
  });

  it('se encuentran por el nombre del artículo', () => {
    expect(matchesQuery(stock, 'cera')).toBe(true);
  });
});
