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
 * proxy corte la conexion por inactividad, y para que la web sepa que sigue
 * viva: dos latidos perdidos y la web reabre el hilo (`lib/realtime.ts`).
 */
export interface CarwashHeartbeat {
  type: 'ping';
  at: string;
}

/**
 * spec 065 — Eventos del inventario que viajan por el mismo stream de oficina.
 *
 * No entran en `CARWASH_EVENT_TYPES` a propósito: un `CarwashEvent` lleva un
 * `Ticket` entero y un aviso de mínimo no tiene lavado. Van como un mensaje
 * propio del mismo hilo, y el API los manda solo a quien tiene
 * `inventory.read` (065 RN-13, 058 RN-2).
 */
export const INVENTORY_EVENT_TYPES = ['inventory.low_stock'] as const;

export type InventoryEventType = (typeof INVENTORY_EVENT_TYPES)[number];

/** El artículo que cruzó el mínimo. Cantidades con tres decimales, como cadena. */
export interface InventoryLowStockPayload {
  itemId: string;
  name: string;
  stockOnHand: string;
  minStock: string;
  unit: string;
}

/**
 * Un artículo quedó en o bajo su mínimo viniendo de arriba (RN-13). Sale una
 * vez por cruce; no se repite hasta que la existencia vuelva a pasar el mínimo.
 */
export interface InventoryLowStockEvent extends InventoryLowStockPayload {
  /** uuid del evento, para deduplicar tras una reconexión. */
  id: string;
  type: 'inventory.low_stock';
  /** ISO, hora del servidor. */
  at: string;
  /** Quien hizo el movimiento que lo cruzó. */
  actor: CarwashEventActor | null;
}

/** Todo lo que puede llegar por el stream de oficina, menos el latido. */
export type LiveEvent = CarwashEvent | InventoryLowStockEvent;

/** Lo que puede llegar por el stream. */
export type CarwashStreamMessage = LiveEvent | CarwashHeartbeat;

export function isHeartbeat(message: CarwashStreamMessage): message is CarwashHeartbeat {
  return message.type === 'ping';
}

/** `true` si el mensaje es del inventario y no de un lavado (065). */
export function isInventoryEvent(message: CarwashStreamMessage): message is InventoryLowStockEvent {
  return message.type === 'inventory.low_stock';
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
