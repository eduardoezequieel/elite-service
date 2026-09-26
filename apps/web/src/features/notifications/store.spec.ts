import type { Notification } from './notification';
import {
  NOTIFICATION_LIMIT,
  addNotification,
  markAllRead,
  markRead,
  parseStored,
  pruneToDays,
  unreadCount,
} from './store';

function notification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n-1',
    title: '#142 pasó a listo',
    description: 'P123-456',
    by: 'Carlos · pista',
    tone: 'go',
    kind: 'move',
    href: '/carwash/t-1',
    at: '2026-09-13T15:00:00.000Z',
    read: false,
    ...overrides,
  };
}

describe('addNotification', () => {
  it('pone el más nuevo arriba', () => {
    const list = addNotification([notification()], notification({ id: 'n-2' }));

    expect(list.map((item) => item.id)).toEqual(['n-2', 'n-1']);
  });

  it('no cuenta dos veces el mismo evento: una reconexión puede reenviarlo', () => {
    const list = addNotification([notification()], notification({ title: 'otro título' }));

    expect(list).toHaveLength(1);
    expect(list[0]?.title).toBe('#142 pasó a listo');
  });

  it('recorta al tope', () => {
    const full = Array.from({ length: NOTIFICATION_LIMIT }, (_, index) =>
      notification({ id: `n-${index}` }),
    );

    const list = addNotification(full, notification({ id: 'nuevo' }));

    expect(list).toHaveLength(NOTIFICATION_LIMIT);
    expect(list[0]?.id).toBe('nuevo');
  });
});

describe('leído y no leído', () => {
  const list = [
    notification(),
    notification({ id: 'n-2' }),
    notification({ id: 'n-3', read: true }),
  ];

  it('cuenta solo lo que no se leyó', () => {
    expect(unreadCount(list)).toBe(2);
    expect(unreadCount(markAllRead(list))).toBe(0);
  });

  it('marca uno solo', () => {
    expect(unreadCount(markRead(list, 'n-2'))).toBe(1);
  });

  it('marcar lo ya leído no cambia el objeto', () => {
    const marked = markAllRead(list);

    expect(marked[2]).toBe(list[2]);
  });
});

describe('pruneToDays', () => {
  // Hora local, no UTC: el dia de la bandeja es el del aparato.
  const local = (day: number, hour: number, minute = 0) =>
    new Date(2026, 8, day, hour, minute, 0).toISOString();

  const now = new Date(2026, 8, 20, 18, 0, 0);

  it('deja los de hoy', () => {
    expect(pruneToDays([notification({ at: local(20, 12) })], now)).toHaveLength(1);
  });

  it('deja los de ayer: la bandeja es de la semana, no de la jornada (058)', () => {
    expect(pruneToDays([notification({ at: local(19, 18) })], now)).toHaveLength(1);
  });

  it('deja entero el día más viejo de la ventana, incluso de madrugada', () => {
    expect(pruneToDays([notification({ at: local(14, 0, 30) })], now)).toHaveLength(1);
  });

  it('tira lo anterior a la ventana', () => {
    expect(pruneToDays([notification({ at: local(13, 23) })], now)).toHaveLength(0);
  });

  it('respeta una ventana más corta si se le pide', () => {
    expect(pruneToDays([notification({ at: local(19, 18) })], now, 1)).toHaveLength(0);
  });

  it('tira lo que no tiene fecha legible antes que mostrar «Invalid Date»', () => {
    expect(pruneToDays([notification({ at: 'no es una fecha' })], now)).toHaveLength(0);
  });
});

describe('parseStored', () => {
  it('lee lo que tiene la forma de un aviso', () => {
    expect(parseStored([notification()])).toHaveLength(1);
  });

  it('descarta los guardados antes del tipo (058): sin `kind` no se sabe si es dinero', () => {
    const { kind: _kind, ...old } = notification();

    expect(parseStored([old])).toHaveLength(0);
  });

  it('lee el aviso de inventario (065)', () => {
    expect(parseStored([{ ...notification(), kind: 'stock' }])).toHaveLength(1);
  });

  it('descarta un tipo que no existe', () => {
    expect(parseStored([{ ...notification(), kind: 'lo-que-sea' }])).toHaveLength(0);
  });

  it('lo que no es una lista no es una bandeja', () => {
    expect(parseStored({ items: [] })).toEqual([]);
    expect(parseStored(null)).toEqual([]);
  });
});
