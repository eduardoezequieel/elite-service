import type { LowStockDraft, LowStockPublisher } from '../ports/low-stock-events';

/** Guarda los avisos de mínimo publicados, para que el test los cuente. */
export class InMemoryLowStockEvents implements LowStockPublisher {
  readonly published: LowStockDraft[] = [];

  publishLowStock(draft: LowStockDraft): void {
    this.published.push(draft);
  }
}
