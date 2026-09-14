import type { TicketEventDraft, TicketEventsPublisher } from '../ports/ticket-events';

/**
 * Publicador de mentira para los tests: guarda lo publicado y no hace nada mas.
 * Es el equivalente de `InMemoryCashSessionRepository` para los eventos.
 */
export class InMemoryTicketEvents implements TicketEventsPublisher {
  readonly published: TicketEventDraft[] = [];

  publish(draft: TicketEventDraft): void {
    this.published.push(draft);
  }

  /** Los tipos publicados, en orden. Lo que se afirma casi siempre. */
  get types(): string[] {
    return this.published.map((draft) => draft.type);
  }

  get last(): TicketEventDraft | undefined {
    return this.published.at(-1);
  }

  clear(): void {
    this.published.length = 0;
  }
}
