import { randomUUID } from 'node:crypto';

import type { CarwashEvent } from '@elite/shared';
import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

import type {
  TicketEventDraft,
  TicketEventsPublisher,
  TicketEventsStream,
} from '../application/ports/ticket-events';

/**
 * El bus en memoria de los eventos del lavado (042).
 *
 * Un solo proceso, un solo `Subject`: alcanza porque el API corre en una
 * instancia. Si algun dia corre en varias, esta clase es lo unico que cambia
 * —por Redis o Postgres LISTEN/NOTIFY— y ni los casos de uso ni los controllers
 * se enteran: hablan con los puertos, no con esto.
 *
 * Es tambien donde se estampan el `id` y la hora, para que el caso de uso no
 * tenga que inventar ninguna de las dos.
 */
@Injectable()
export class TicketEventsBus implements TicketEventsPublisher, TicketEventsStream {
  private readonly events = new Subject<CarwashEvent>();

  publish(draft: TicketEventDraft): void {
    this.events.next({
      id: randomUUID(),
      at: new Date().toISOString(),
      ...draft,
    });
  }

  subscribe(listener: (event: CarwashEvent) => void): () => void {
    const subscription = this.events.subscribe(listener);

    return () => subscription.unsubscribe();
  }
}
