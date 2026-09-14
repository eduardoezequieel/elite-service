import type { Notification } from './notification';
import {
  NOTIFICATION_LIMIT,
  addNotification,
  markAllRead,
  markRead,
  pruneToDay,
  unreadCount,
} from './store';

function notification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n-1',
    title: '#142 pasó a listo',
    description: 'P123-456',
    tone: 'go',
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

describe('pruneToDay', () => {
  const now = new Date('2026-09-13T18:00:00.000Z');

  it('deja los de hoy', () => {
    const today = notification({ at: now.toISOString() });

    expect(pruneToDay([today], now)).toHaveLength(1);
  });

  it('tira los de ayer: el lavado es un negocio de jornada', () => {
    const yesterday = notification({ at: '2026-09-12T18:00:00.000Z' });

    expect(pruneToDay([yesterday], now)).toHaveLength(0);
  });

  it('tira lo que no tiene fecha legible antes que mostrar «Invalid Date»', () => {
    expect(pruneToDay([notification({ at: 'no es una fecha' })], now)).toHaveLength(0);
  });
});
