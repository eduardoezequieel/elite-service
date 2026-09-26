import type { CarwashStreamMessage, LiveEvent } from '@elite/shared';
import { STREAM_HEARTBEAT_MS, STREAM_MAX_AGE_MS } from '@elite/shared';
import type { MessageEvent } from '@nestjs/common';
import { Observable, filter, interval, map, merge, takeUntil, timer } from 'rxjs';

/** Una fuente de eventos en callbacks: el puerto del bus, visto desde un stream. */
export type EventFeed<T> = (listener: (event: T) => void) => () => void;

/**
 * El cano de SSE que comparten los dos streams (042).
 *
 * No es logica de negocio —eso vive en `domain/carwash-event.ts`—, es la
 * plomeria del transporte: adaptar el puerto de callbacks a un `Observable`,
 * latir y cerrar a tiempo.
 */
function asObservable<T>(source: EventFeed<T>): Observable<T> {
  return new Observable<T>((subscriber) => source((event) => subscriber.next(event)));
}

/**
 * La pista pasa `subscribe` (solo lavados) y la oficina `subscribeLive`
 * (lavados y avisos de inventario, 065): el hilo de pista nunca ve un aviso
 * de minimo, ni siquiera para descartarlo.
 */
export function ticketEventStream<T extends LiveEvent>(
  source: EventFeed<T>,
  isVisible: (event: T) => boolean,
): Observable<MessageEvent> {
  // El latido existe para que ningun proxy de por medio de por muerta una
  // conexion que solo esta callada. En un taller tranquilo pasan minutos sin
  // que se mueva un lavado.
  const heartbeat = interval(STREAM_HEARTBEAT_MS).pipe(
    map((): CarwashStreamMessage => ({ type: 'ping', at: new Date().toISOString() })),
  );

  return merge(asObservable(source).pipe(filter(isVisible)), heartbeat).pipe(
    map((data): MessageEvent => ({ data })),
    // Se cierra sola y `EventSource` reconecta. Es lo que mantiene en pie la
    // regla de resolver los permisos contra la base: la conexion nueva vuelve a
    // pasar por los guards, asi que un rol revocado deja de recibir.
    takeUntil(timer(STREAM_MAX_AGE_MS)),
  );
}
