import type { Ticket, TicketWasher } from '@elite/shared';

import { durationLabel, secondsSince } from './duration';

/**
 * El tablero de pista (spec 049, en kanban desde la 089), armado en una
 * función pura.
 *
 * Es la pantalla que se mira de lejos: tres columnas por estado —en cola,
 * lavando, listos para cobrar— y abajo una franja por lavador. Acá no hay React
 * ni fechas del navegador: todo entra por parámetro —los lavados del día y una
 * marca de reloj— para que el cronómetro se pueda probar sin esperar un
 * segundo real.
 */

/** Un carro en la bahía, con su cronómetro. */
export interface BoardWashing {
  ticket: Ticket;
  /** Desde cuándo lo están lavando. `null` en un `WASHING` sin marca (raro). */
  startedAt: string | null;
  /** Lo que lleva corriendo contra el `now` que se pasó. */
  elapsedSeconds: number;
}

/** La franja de un lavador: cuánto sacó hoy y si está libre. */
export interface BoardWasher {
  washer: TicketWasher;
  /** Tiene un carro en la bahía ahora mismo. */
  busy: boolean;
  /** Lo que ya sacó hoy: `READY` y `PAID`. */
  doneToday: number;
  /**
   * Media de `readyAt − washingStartedAt` sobre los terminados que tienen las
   * dos marcas. `null` si ninguno las tiene: un promedio sobre nada mentiría.
   */
  averageSeconds: number | null;
}

/** Los contadores de las cabeceras de columna. */
export interface BoardTotals {
  open: number;
  washing: number;
  ready: number;
}

export interface Board {
  /** Los `OPEN`, tengan o no lavador, del más viejo al más nuevo. */
  queued: Ticket[];
  /** Los `WASHING`, el que más lleva primero: es el que hay que mirar. */
  washing: BoardWashing[];
  /** Los `READY`, el que más espera en el mostrador primero. */
  ready: Ticket[];
  /** Quien tocó un lavado hoy, por nombre. */
  washers: BoardWasher[];
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
 * De quién es el lavado.
 *
 * El asignado que cobra comisión (`washers[0]`, spec 035) manda sobre quien
 * abrió el lavado (`washer`, spec 003): si oficina abrió el carro y después se
 * lo pasó a alguien, el carro es de quien lo está lavando, no de oficina.
 */
export function laneWasherOf(ticket: Ticket): TicketWasher | null {
  return ticket.washers[0] ?? ticket.washer;
}

interface WasherTally {
  washer: TicketWasher;
  busy: boolean;
  doneToday: number;
  spans: number[];
}

export function buildBoard(tickets: readonly Ticket[], now: number): Board {
  // Lo anulado no cuenta en ningún lado: ni columna, ni contador, ni promedio.
  const alive = tickets.filter((ticket) => ticket.status !== 'VOID');
  const tallies = new Map<string, WasherTally>();

  for (const ticket of alive) {
    const washer = laneWasherOf(ticket);

    if (washer === null) continue;

    let tally = tallies.get(washer.id);

    if (tally === undefined) {
      tally = { washer, busy: false, doneToday: 0, spans: [] };
      tallies.set(washer.id, tally);
    }

    if (ticket.status === 'WASHING') {
      tally.busy = true;
    } else if (ticket.status === 'READY' || ticket.status === 'PAID') {
      tally.doneToday += 1;

      // Un lavado que saltó de `OPEN` a `READY` sin pasar por la bahía no tiene
      // tramo que medir, y uno anterior a la 046 no tiene `readyAt`: los dos
      // quedan fuera del promedio en vez de contar como cero.
      if (ticket.washingStartedAt !== null && ticket.readyAt !== null) {
        tally.spans.push(
          (new Date(ticket.readyAt).getTime() - new Date(ticket.washingStartedAt).getTime()) /
            1000,
        );
      }
    }
  }

  const washers = [...tallies.values()]
    .map(({ washer, busy, doneToday, spans }) => ({
      washer,
      busy,
      doneToday,
      averageSeconds:
        spans.length === 0
          ? null
          : Math.round(spans.reduce((sum, span) => sum + span, 0) / spans.length),
    }))
    .sort((left, right) => left.washer.fullName.localeCompare(right.washer.fullName, 'es'));

  const queued = alive
    .filter((ticket) => ticket.status === 'OPEN')
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const washing = alive
    .filter((ticket) => ticket.status === 'WASHING')
    .map((ticket) => ({
      ticket,
      startedAt: ticket.washingStartedAt,
      elapsedSeconds:
        ticket.washingStartedAt === null ? 0 : secondsSince(ticket.washingStartedAt, now),
    }))
    .sort((left, right) => right.elapsedSeconds - left.elapsedSeconds);
  const ready = alive
    .filter((ticket) => ticket.status === 'READY')
    .sort((left, right) => (left.readyAt ?? '').localeCompare(right.readyAt ?? ''));

  return {
    queued,
    washing,
    ready,
    washers,
    totals: { open: queued.length, washing: washing.length, ready: ready.length },
  };
}
