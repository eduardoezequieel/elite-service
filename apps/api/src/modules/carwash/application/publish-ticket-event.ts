import type { TicketEventDraft, TicketEventsPublisher } from './ports/ticket-events';

/**
 * Cuenta lo que acaba de pasar (042).
 *
 * Va en `try/catch` a proposito: el aviso es un efecto de segundo orden y un
 * oyente roto no puede tumbar un cobro que ya se escribio en la base.
 */
export function publishTicketEvent(events: TicketEventsPublisher, draft: TicketEventDraft): void {
  try {
    events.publish(draft);
  } catch {
    // Avisar es opcional; la mutacion ya esta hecha.
  }
}
