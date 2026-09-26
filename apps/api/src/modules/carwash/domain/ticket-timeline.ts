import type { TicketPriceChange, TicketTimeline, TicketTimelineSegment } from '@elite/shared';

import type { WorkOrderStatus } from './work-order';

/**
 * Una fila del historial, tal como quedo escrita (046 RN-2).
 *
 * El actor viene desarmado —tipo y nombre— porque es un snapshot: el nombre no
 * se vuelve a leer del empleado, que pudo cambiar o desaparecer (RN-4).
 */
/**
 * El detalle de un cambio de precio autorizado (060). Todo congelado al momento
 * del cambio: el nombre del servicio, los dos precios y el motivo.
 */
export interface PriceChangeDetail {
  serviceName: string;
  previousUnitPrice: string;
  unitPrice: string;
  reason: string;
}

export interface StatusEventRecord {
  id: string;
  /**
   * Que cuenta la fila (060). `status` es la entrada a un estado de la 046 —lo
   * unico que arma tramos—; `price` es un cambio de precio autorizado, que no
   * mueve el estado. Ausente se lee como `status`: asi lo son todas las filas
   * anteriores a la 060.
   */
  kind?: 'status' | 'price';
  /** Solo en `kind: 'price'`: que linea cambio y de cuanto a cuanto. */
  price?: PriceChangeDetail;
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
  // Solo las entradas a un estado arman tramos: un cambio de precio ocurre
  // dentro de un estado y no lo corta en dos (060).
  const ordered = events
    .filter((event) => (event.kind ?? 'status') === 'status')
    .sort(byOccurredAt);

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

  return { segments, priceChanges: priceChangesOf(events), recorded: segments.length > 0 };
}

/**
 * Los cambios de precio firmados, del mas viejo al mas nuevo (060).
 *
 * Una fila sin nombre de quien autorizo se descarta: un precio cambiado sin
 * firma es justo lo que la spec prohibe, y pintarlo como anonimo seria peor que
 * no pintarlo.
 */
function priceChangesOf(events: readonly StatusEventRecord[]): TicketPriceChange[] {
  return [...events]
    .filter((event) => event.kind === 'price' && event.price !== undefined)
    .sort(byOccurredAt)
    .flatMap((event) =>
      event.price === undefined || event.actorName === null
        ? []
        : [
            {
              id: event.id,
              serviceName: event.price.serviceName,
              previousUnitPrice: event.price.previousUnitPrice,
              unitPrice: event.price.unitPrice,
              reason: event.price.reason,
              authorizedBy: event.actorName,
              changedAt: event.occurredAt.toISOString(),
            },
          ],
    );
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
