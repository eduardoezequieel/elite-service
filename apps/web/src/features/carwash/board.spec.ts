import type { Ticket, TicketWasher, WorkOrderStatus } from '@elite/shared';

import { averageLabel, buildBoard, elapsedClock } from './board';

const carlos: TicketWasher = { id: 'c', username: 'carlos', fullName: 'Carlos Menjívar' };
const ana: TicketWasher = { id: 'a', username: 'ana', fullName: 'Ana Rivas' };

const BODY_TYPE = { id: 'b1', key: 'sedan', name: 'Sedán', sortOrder: 1 };

const NOW = Date.parse('2026-09-20T15:00:00.000Z');

/** Minutos antes de `NOW`, en ISO: así el caso se lee como se lee la pista. */
function minutesAgo(minutes: number): string {
  return new Date(NOW - minutes * 60_000).toISOString();
}

interface TicketOptions {
  washer?: TicketWasher | null;
  washers?: TicketWasher[];
  total?: string;
  washingStartedAt?: string | null;
  readyAt?: string | null;
  createdAt?: string;
}

function ticket(number: number, status: WorkOrderStatus, options: TicketOptions = {}): Ticket {
  const washer = options.washer ?? null;

  return {
    id: `t${number}`,
    number: `CW-${String(number).padStart(4, '0')}`,
    status,
    customer: null,
    vehicle: {
      id: `v${number}`,
      plate: `P000-${String(number).padStart(3, '0')}`,
      bodyType: BODY_TYPE,
      make: 'Toyota',
      color: null,
      isActive: true,
      currentOwner: null,
      lastWash: null,
    },
    bodyType: BODY_TYPE,
    items: [],
    total: options.total ?? '10.00',
    washer,
    washers: options.washers ?? (washer === null ? [] : [washer]),
    commissionTotal: null,
    notes: null,
    payment: null,
    washingStartedAt: options.washingStartedAt ?? null,
    readyAt: options.readyAt ?? null,
    createdAt: options.createdAt ?? minutesAgo(30),
    updatedAt: minutesAgo(1),
  };
}

describe('buildBoard (049)', () => {
  it('un abierto sin lavador no abre columna, pero cuenta en la cola', () => {
    const board = buildBoard([ticket(1, 'OPEN')], NOW);

    expect(board.washers).toHaveLength(0);
    expect(board.totals.open).toBe(1);
  });

  it('el que saltó a listo sin pasar por la bahía no entra al promedio', () => {
    const board = buildBoard(
      [
        ticket(1, 'PAID', {
          washer: carlos,
          washingStartedAt: minutesAgo(60),
          readyAt: minutesAgo(40),
        }),
        // Sin `washingStartedAt`: no hay tramo que medir.
        ticket(2, 'READY', { washer: carlos, readyAt: minutesAgo(10) }),
      ],
      NOW,
    );

    expect(board.washers[0]?.doneToday).toHaveLength(2);
    expect(board.washers[0]?.averageSeconds).toBe(20 * 60);
  });

  it('sin ningún tramo medible el promedio es nulo, no cero', () => {
    const board = buildBoard([ticket(1, 'READY', { washer: carlos })], NOW);

    expect(board.washers[0]?.averageSeconds).toBeNull();
  });

  it('lo anulado no aparece en ningún lado', () => {
    const board = buildBoard([ticket(1, 'VOID', { washer: carlos, total: '99.00' })], NOW);

    expect(board.washers).toHaveLength(0);
    expect(board.ready).toHaveLength(0);
    expect(board.totals).toEqual({ open: 0, washing: 0, ready: 0, paidCents: 0 });
  });

  it('dos lavadores dan dos columnas, ordenadas por nombre', () => {
    const board = buildBoard(
      [ticket(1, 'WASHING', { washer: carlos }), ticket(2, 'OPEN', { washer: ana })],
      NOW,
    );

    expect(board.washers.map((lane) => lane.washer.fullName)).toEqual([
      'Ana Rivas',
      'Carlos Menjívar',
    ]);
  });

  it('cobrado hoy suma solo los cobrados', () => {
    const board = buildBoard(
      [
        ticket(1, 'PAID', { washer: carlos, total: '14.50' }),
        ticket(2, 'PAID', { washer: ana, total: '8.25' }),
        ticket(3, 'READY', { washer: ana, total: '99.00' }),
        ticket(4, 'VOID', { washer: ana, total: '99.00' }),
      ],
      NOW,
    );

    expect(board.totals.paidCents).toBe(2275);
  });

  it('el carro en curso trae su cronómetro', () => {
    const board = buildBoard(
      [ticket(1, 'WASHING', { washer: carlos, washingStartedAt: minutesAgo(7) })],
      NOW,
    );

    expect(board.washers[0]?.current?.elapsedSeconds).toBe(7 * 60);
    expect(board.washers[0]?.current?.ticket.id).toBe('t1');
  });

  it('la columna es de quien cobra comisión, no de quien abrió', () => {
    // Oficina abrió el carro (`washer` nulo) y después se lo pasó a Ana.
    const board = buildBoard([ticket(1, 'WASHING', { washers: [ana] })], NOW);

    expect(board.washers.map((lane) => lane.washer.id)).toEqual(['a']);
  });

  it('la cola de cada lavador va del más viejo al más nuevo', () => {
    const board = buildBoard(
      [
        ticket(2, 'OPEN', { washer: carlos, createdAt: minutesAgo(5) }),
        ticket(1, 'OPEN', { washer: carlos, createdAt: minutesAgo(25) }),
      ],
      NOW,
    );

    expect(board.washers[0]?.queued.map((row) => row.id)).toEqual(['t1', 't2']);
  });

  it('los listos para cobrar salen todos, con lavador o sin él', () => {
    const board = buildBoard(
      [
        ticket(1, 'READY', { washer: carlos, readyAt: minutesAgo(4) }),
        ticket(2, 'READY', { readyAt: minutesAgo(20) }),
      ],
      NOW,
    );

    expect(board.ready.map((row) => row.id)).toEqual(['t2', 't1']);
    expect(board.totals.ready).toBe(2);
  });
});

describe('las palabras del tablero', () => {
  it('el cronómetro se lee como un reloj', () => {
    expect(elapsedClock(0)).toBe('0:00');
    expect(elapsedClock(64)).toBe('1:04');
    expect(elapsedClock(45 * 60)).toBe('45:00');
    expect(elapsedClock(3920)).toBe('1:05:20');
    expect(elapsedClock(-5)).toBe('0:00');
  });

  it('el promedio dice cuándo no lo hay, en vez de mostrar un cero', () => {
    expect(averageLabel(null)).toBe('sin promedio aún');
    expect(averageLabel(20 * 60)).toBe('20 min promedio');
    expect(averageLabel(3900)).toBe('1 h 05 min promedio');
  });
});
