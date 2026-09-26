/**
 * La línea de tiempo del lavado, en un solo hilo (046 + 060).
 *
 * El API manda dos listas —los tramos de estado y los cambios de precio
 * firmados— y la pantalla tiene que contar **una** historia: lo que pasó, en el
 * orden en que pasó. Esto las intercala por hora.
 *
 * Vive suelto y sin React porque el orden es lo único que hay que probar acá, y
 * porque un cambio de precio mal ubicado en el hilo cuenta otra historia: la de
 * un descuento que no se hizo cuando se hizo.
 *
 * Con la misma hora manda el tramo: primero se entra al estado y después pasa
 * lo que pasa adentro.
 */

import type { TicketPriceChange, TicketTimeline, TicketTimelineSegment } from '@elite/shared';

export type TimelineEntry =
  | { kind: 'segment'; at: string; segment: TicketTimelineSegment }
  | { kind: 'price'; at: string; change: TicketPriceChange };

/** Milisegundos de un ISO. Una fecha ilegible cae al principio antes que romper el orden. */
function timeOfIso(iso: string): number {
  const parsed = new Date(iso).getTime();

  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Los dos hilos en uno, del más viejo al más nuevo. Sin cambios de precio
 * —el caso normal— devuelve exactamente los tramos, en su orden.
 */
export function timelineEntries(
  timeline: Pick<TicketTimeline, 'segments' | 'priceChanges'>,
): TimelineEntry[] {
  const entries: { entry: TimelineEntry; at: number; rank: number; order: number }[] = [
    ...timeline.segments.map((segment, index) => ({
      entry: { kind: 'segment', at: segment.enteredAt, segment } as TimelineEntry,
      at: timeOfIso(segment.enteredAt),
      rank: 0,
      order: index,
    })),
    ...timeline.priceChanges.map((change, index) => ({
      entry: { kind: 'price', at: change.changedAt, change } as TimelineEntry,
      at: timeOfIso(change.changedAt),
      rank: 1,
      order: index,
    })),
  ];

  return entries
    .sort((a, b) => a.at - b.at || a.rank - b.rank || a.order - b.order)
    .map((row) => row.entry);
}
