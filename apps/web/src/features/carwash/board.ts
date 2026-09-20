import type { Ticket, TicketWasher } from '@elite/shared';

import { centsOf } from './cash-format';
import { durationLabel, secondsSince } from './duration';

/**
 * El tablero de pista (spec 049), armado en una función pura.
 *
 * Es la pantalla que se mira de lejos: una columna por lavador con el carro que
 * tiene encima, lo que le espera y lo que terminó hoy. Acá no hay React ni
 * fechas del navegador: todo entra por parámetro —los lavados del día y una
 * marca de reloj— para que el cronómetro se pueda probar sin esperar un
 * segundo real.
 */

/** El carro que el lavador tiene encima ahora mismo, con su cronómetro. */
export interface BoardCurrent {
  ticket: Ticket;
  /** Desde cuándo lo está lavando. `null` en un `WASHING` sin marca (raro). */
  startedAt: string | null;
  /** Lo que lleva corriendo contra el `now` que se pasó. */
  elapsedSeconds: number;
}

/** Una columna del tablero. */
export interface BoardLane {
  washer: TicketWasher;
  current: BoardCurrent | null;
  /** Sus `OPEN`, del más viejo al más nuevo: ese es el orden en que los toma. */
  queued: Ticket[];
  /** Lo que ya sacó hoy: `READY` y `PAID`. */
  doneToday: Ticket[];
  /**
   * Media de `readyAt − washingStartedAt` sobre los terminados que tienen las
   * dos marcas. `null` si ninguno las tiene: un promedio sobre nada mentiría.
   */
  averageSeconds: number | null;
}

/** Los contadores de la cabecera. */
export interface BoardTotals {
  open: number;
  washing: number;
  ready: number;
  /** Suma de los `PAID`, en centavos enteros. Solo se dibuja con `carwash.cash`. */
  paidCents: number;
}

export interface Board {
  washers: BoardLane[];
  /** Todos los `READY` del día, tengan o no lavador, del más viejo al más nuevo. */
  ready: Ticket[];
  totals: BoardTotals;
}

/**
 * El cronómetro grande del carro en curso: `27:14`, y `1:05:20` pasada la hora.
 *
 * No usa el vocabulario de la 046 («27 min 14 s») a propósito: a tres metros y
 * en 57px, un reloj de dos puntos se lee de un golpe y la frase no entra en el
 * ancho de la columna.
 */
export function elapsedClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = String(safe % 60).padStart(2, '0');

  if (minutes < 60) return `${minutes}:${rest}`;

  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:${rest}`;
}

/** Lo que tarda en promedio, o que todavía no hay con qué decirlo. */
export function averageLabel(seconds: number | null): string {
  if (seconds === null) return 'sin promedio aún';

  return `${durationLabel(seconds)} promedio`;
}

/**
 * De quién es la columna.
 *
 * El asignado que cobra comisión (`washers[0]`, spec 035) manda sobre quien
 * abrió el lavado (`washer`, spec 003): si oficina abrió el carro y después se
 * lo pasó a alguien, la columna es de quien lo está lavando, no de oficina.
 */
export function laneWasherOf(ticket: Ticket): TicketWasher | null {
  return ticket.washers[0] ?? ticket.washer;
}

export function buildBoard(tickets: readonly Ticket[], now: number): Board {
  // Lo anulado no cuenta en ningún lado: ni columna, ni contador, ni promedio.
  const alive = tickets.filter((ticket) => ticket.status !== 'VOID');
  const lanes = new Map<string, BoardLane>();

  for (const ticket of alive) {
    const washer = laneWasherOf(ticket);

    // Un carro abierto que nadie tomó no abre columna: es raro, es asunto de
    // oficina y ya está contado en «En cola».
    if (washer === null) continue;

    let lane = lanes.get(washer.id);

    if (lane === undefined) {
      lane = { washer, current: null, queued: [], doneToday: [], averageSeconds: null };
      lanes.set(washer.id, lane);
    }

    if (ticket.status === 'WASHING') {
      lane.current = {
        ticket,
        startedAt: ticket.washingStartedAt,
        elapsedSeconds:
          ticket.washingStartedAt === null ? 0 : secondsSince(ticket.washingStartedAt, now),
      };
    } else if (ticket.status === 'OPEN') {
      lane.queued.push(ticket);
    } else {
      lane.doneToday.push(ticket);
    }
  }

  for (const lane of lanes.values()) {
    // Un lavado que saltó de `OPEN` a `READY` sin pasar por la bahía no tiene
    // tramo que medir, y uno anterior a la 046 no tiene `readyAt`: los dos
    // quedan fuera del promedio en vez de contar como cero.
    const spans = lane.doneToday.flatMap(({ washingStartedAt, readyAt }) => {
      if (washingStartedAt === null || readyAt === null) return [];

      return [(new Date(readyAt).getTime() - new Date(washingStartedAt).getTime()) / 1000];
    });

    lane.averageSeconds =
      spans.length === 0
        ? null
        : Math.round(spans.reduce((sum, span) => sum + span, 0) / spans.length);
    lane.queued.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  const washers = [...lanes.values()].sort((left, right) =>
    left.washer.fullName.localeCompare(right.washer.fullName, 'es'),
  );
  const ready = alive
    .filter((ticket) => ticket.status === 'READY')
    .sort((left, right) => (left.readyAt ?? '').localeCompare(right.readyAt ?? ''));

  return {
    washers,
    ready,
    totals: {
      open: alive.filter((ticket) => ticket.status === 'OPEN').length,
      washing: alive.filter((ticket) => ticket.status === 'WASHING').length,
      ready: ready.length,
      paidCents: alive
        .filter((ticket) => ticket.status === 'PAID')
        .reduce((sum, ticket) => sum + (centsOf(ticket.total) ?? 0), 0),
    },
  };
}
