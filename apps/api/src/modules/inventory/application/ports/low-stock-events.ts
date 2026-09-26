import type { CarwashEventActor, InventoryLowStockPayload } from '@elite/shared';

/**
 * El puerto por el que se avisa que un artículo cruzó el mínimo (065 RN-13).
 *
 * Lo implementa el bus del stream de la 042 (`TicketEventsBus`), que estampa
 * `id`, `type` y hora. Lo usan el inventario, el lavado y la venta suelta
 * **después** de confirmar la transacción: un aviso de algo que se deshizo no
 * se manda.
 */
export interface LowStockDraft extends InventoryLowStockPayload {
  actor: CarwashEventActor | null;
}

/** Nunca falla: avisar no puede tumbar un movimiento ya escrito. */
export interface LowStockPublisher {
  publishLowStock(draft: LowStockDraft): void;
}

export const LOW_STOCK_EVENTS = Symbol('inventory.LowStockEvents');

/** Publica cada aviso sin dejar que un oyente roto rompa al que llama. */
export function publishLowStock(
  events: LowStockPublisher,
  drafts: readonly InventoryLowStockPayload[],
  actor: CarwashEventActor | null,
): void {
  for (const draft of drafts) {
    try {
      events.publishLowStock({ ...draft, actor });
    } catch {
      // Avisar es opcional; el movimiento ya esta hecho.
    }
  }
}
