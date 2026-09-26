import { randomUUID } from 'node:crypto';

import type { CarwashEvent, LiveEvent } from '@elite/shared';
import { isInventoryEvent } from '@elite/shared';
import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

import type {
  LowStockDraft,
  LowStockPublisher,
} from '../../inventory/application/ports/low-stock-events';
import type {
  TicketEventDraft,
  TicketEventsPublisher,
  TicketEventsStream,
} from '../application/ports/ticket-events';

/**
 * El bus en memoria de los eventos del lavado (042) y de los avisos de minimo
 * del inventario (065 RN-13), que viajan por el mismo hilo de oficina.
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
export class TicketEventsBus
  implements TicketEventsPublisher, TicketEventsStream, LowStockPublisher
{
  private readonly events = new Subject<LiveEvent>();

  publish(draft: TicketEventDraft): void {
    this.events.next({
      id: randomUUID(),
      at: new Date().toISOString(),
      ...draft,
    });
  }

  publishLowStock(draft: LowStockDraft): void {
    this.events.next({
      id: randomUUID(),
      type: 'inventory.low_stock',
      at: new Date().toISOString(),
      itemId: draft.itemId,
      name: draft.name,
      stockOnHand: draft.stockOnHand,
      minStock: draft.minStock,
      unit: draft.unit,
      actor: draft.actor,
    });
  }

  subscribe(listener: (event: CarwashEvent) => void): () => void {
    return this.subscribeLive((event) => {
      if (!isInventoryEvent(event)) listener(event);
    });
  }

  subscribeLive(listener: (event: LiveEvent) => void): () => void {
    const subscription = this.events.subscribe(listener);

    return () => subscription.unsubscribe();
  }
}
