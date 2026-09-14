import type { CarwashEvent, CarwashStreamMessage } from '@elite/shared';
import { STREAM_HEARTBEAT_MS, STREAM_MAX_AGE_MS } from '@elite/shared';
import type { MessageEvent } from '@nestjs/common';
import { Observable, filter, interval, map, merge, takeUntil, timer } from 'rxjs';

import type { TicketEventsStream } from '../application/ports/ticket-events';

/**
 * El cano de SSE que comparten los dos streams (042).
 *
 * No es logica de negocio —eso vive en `domain/carwash-event.ts`—, es la
 * plomeria del transporte: adaptar el puerto de callbacks a un `Observable`,
 * latir y cerrar a tiempo.
 */
function asObservable(events: TicketEventsStream): Observable<CarwashEvent> {
  return new Observable<CarwashEvent>((subscriber) =>
    events.subscribe((event) => subscriber.next(event)),
  );
}

export function ticketEventStream(
  events: TicketEventsStream,
  isVisible: (event: CarwashEvent) => boolean,
): Observable<MessageEvent> {
  // El latido existe para que ningun proxy de por medio de por muerta una
  // conexion que solo esta callada. En un taller tranquilo pasan minutos sin
  // que se mueva un lavado.
  const heartbeat = interval(STREAM_HEARTBEAT_MS).pipe(
    map((): CarwashStreamMessage => ({ type: 'ping', at: new Date().toISOString() })),
  );

  return merge(asObservable(events).pipe(filter(isVisible)), heartbeat).pipe(
    map((data): MessageEvent => ({ data })),
    // Se cierra sola y `EventSource` reconecta. Es lo que mantiene en pie la
    // regla de resolver los permisos contra la base: la conexion nueva vuelve a
    // pasar por los guards, asi que un rol revocado deja de recibir.
    takeUntil(timer(STREAM_MAX_AGE_MS)),
  );
}
