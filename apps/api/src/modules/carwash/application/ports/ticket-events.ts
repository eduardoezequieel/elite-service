import type {
  CarwashEvent,
  CarwashEventActor,
  CarwashEventType,
  LiveEvent,
  Ticket,
  WorkOrderStatus,
} from '@elite/shared';

/**
 * El puerto por el que el caso de uso cuenta lo que paso (042).
 *
 * Deliberadamente en callbacks planos y no en `Observable`: asi el test del
 * caso de uso no monta rxjs ni nada, igual que los repositorios en memoria.
 * Quien lo implementa con un `Subject` es `infrastructure/`.
 */

/** Lo que publica el caso de uso. El `id` y la hora los pone el bus. */
export interface TicketEventDraft {
  type: CarwashEventType;
  ticket: Ticket;
  /** El estado de antes. `null` si el evento no movio el estado. */
  previousStatus: WorkOrderStatus | null;
  actor: CarwashEventActor | null;
}

/** Lo que usa el caso de uso. Nunca falla: avisar no puede tumbar una mutacion. */
export interface TicketEventsPublisher {
  publish(draft: TicketEventDraft): void;
}

/** Lo que usa el controller del stream. Devuelve como desuscribirse. */
export interface TicketEventsStream {
  /** Solo los del lavado: lo que escucha la pista. */
  subscribe(listener: (event: CarwashEvent) => void): () => void;
  /**
   * Los del lavado y los del inventario (065 RN-13): lo que escucha la oficina.
   * Quien decide que le llega a cada uno es el controller, con la regla de
   * `domain/carwash-event.ts`.
   */
  subscribeLive(listener: (event: LiveEvent) => void): () => void;
}

/** Un solo objeto cumple los dos roles; el modulo lo registra una vez. */
export const TICKET_EVENTS = Symbol('carwash.TicketEvents');
