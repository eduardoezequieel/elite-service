import type { TicketTimeline, TicketTimelineSegment } from '@elite/shared';

import type { WorkOrderStatus } from './work-order';

/**
 * Una fila del historial, tal como quedo escrita (046 RN-2).
 *
 * El actor viene desarmado —tipo y nombre— porque es un snapshot: el nombre no
 * se vuelve a leer del empleado, que pudo cambiar o desaparecer (RN-4).
 */
export interface StatusEventRecord {
  id: string;
  fromStatus: WorkOrderStatus | null;
  toStatus: WorkOrderStatus;
  actorKind: 'user' | 'employee' | null;
  actorName: string | null;
  occurredAt: Date;
}

/**
 * De filas a tramos: cada evento abre un tramo que el siguiente cierra (RN-5).
 *
 * El ultimo queda abierto a proposito. Cuanto lleva ahi depende de «ahora», y
 * ese dato envejece en el camino al navegador: lo cuenta la pantalla con su
 * propio reloj, no este calculo.
 */
export function buildTimeline(events: readonly StatusEventRecord[]): TicketTimeline {
  const ordered = [...events].sort(byOccurredAt);

  const segments: TicketTimelineSegment[] = ordered.map((event, index) => {
    const next = ordered[index + 1];
    const enteredAt = event.occurredAt;

    return {
      id: event.id,
      status: event.toStatus,
      enteredAt: enteredAt.toISOString(),
      leftAt: next === undefined ? null : next.occurredAt.toISOString(),
      durationSeconds: next === undefined ? null : secondsBetween(enteredAt, next.occurredAt),
      actor:
        event.actorKind === null || event.actorName === null
          ? null
          : { kind: event.actorKind, name: event.actorName },
    };
  });

  return { segments, recorded: segments.length > 0 };
}

function byOccurredAt(a: StatusEventRecord, b: StatusEventRecord): number {
  return a.occurredAt.getTime() - b.occurredAt.getTime();
}

/**
 * Segundos enteros, nunca negativos: dos filas con la misma marca dan 0, que es
 * lo que hay que mostrar, y un reloj que retrocede no puede producir un tramo
 * de duracion negativa.
 */
function secondsBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000));
}
