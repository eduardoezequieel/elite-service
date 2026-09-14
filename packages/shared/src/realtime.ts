/**
 * spec 042 — Lo que el API empuja a la web mientras la pantalla esta abierta.
 *
 * Viaja por SSE (`GET /carwash/stream` y `GET /floor/stream`), no por
 * WebSocket: el navegador pega al mismo origen que el resto del API, la cookie
 * httpOnly viaja sola y la reconexion la hace `EventSource`. El porque esta en
 * el ADR-012 de `docs/ARCHITECTURE.md`.
 */

import type { Ticket, WorkOrderStatus } from './contracts';

/**
 * Que paso con el lavado. `ticket.updated` es el cajon de lo que cambia el
 * contenido sin mover el estado (lineas, nota, carroceria, responsable).
 */
export const CARWASH_EVENT_TYPES = [
  'ticket.created',
  'ticket.updated',
  'ticket.status.changed',
  'ticket.assigned',
  'ticket.charged',
  'ticket.reversed',
  'ticket.voided',
] as const;

export type CarwashEventType = (typeof CARWASH_EVENT_TYPES)[number];

/**
 * Quien lo provoco. `null` cuando no se pudo atribuir (una mutacion vieja, un
 * script). La web lo usa para no avisarte de tu propia accion.
 */
export interface CarwashEventActor {
  kind: 'user' | 'employee';
  id: string;
  name: string;
}

/**
 * Un evento del stream.
 *
 * Lleva el `Ticket` entero y ya serializado a proposito: la web no vuelve a
 * pedirlo, y el texto del aviso saca de ahi el folio y la placa sin consultar
 * nada.
 */
export interface CarwashEvent {
  /** uuid del evento. El cliente deduplica con esto tras una reconexion. */
  id: string;
  type: CarwashEventType;
  /** ISO, hora del servidor. */
  at: string;
  ticket: Ticket;
  /** El estado de antes. `null` si el evento no movio el estado. */
  previousStatus: WorkOrderStatus | null;
  actor: CarwashEventActor | null;
}

/**
 * El latido. Va por el mismo stream cada `STREAM_HEARTBEAT_MS` para que ningun
 * proxy corte la conexion por inactividad. La web lo ignora, salvo para saber
 * que sigue viva.
 */
export interface CarwashHeartbeat {
  type: 'ping';
  at: string;
}

/** Lo que puede llegar por el stream. */
export type CarwashStreamMessage = CarwashEvent | CarwashHeartbeat;

export function isHeartbeat(message: CarwashStreamMessage): message is CarwashHeartbeat {
  return message.type === 'ping';
}

/** Cada cuanto late el stream. */
export const STREAM_HEARTBEAT_MS = 25_000;

/**
 * Cuanto vive una conexion antes de cerrarse sola.
 *
 * No es un limite tecnico: es lo que mantiene en pie la regla de que los
 * permisos se resuelven contra la base en cada request. Al cerrarse,
 * `EventSource` reconecta y la conexion nueva vuelve a pasar por los guards, asi
 * que un rol revocado deja de recibir como mucho media hora despues.
 */
export const STREAM_MAX_AGE_MS = 30 * 60 * 1000;
