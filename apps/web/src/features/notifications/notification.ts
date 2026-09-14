import type { CarwashEvent, WorkOrderStatus } from '@elite/shared';

/**
 * De evento a aviso legible (spec 042).
 *
 * Logica pura y sin React a proposito: el texto de una notificacion es lo que
 * alguien lee de reojo mientras atiende a un cliente, y merece un test, no una
 * revision visual.
 */

/** Lo que ve el usuario en la bandeja. */
export interface Notification {
  /** El id del evento. Es lo que deduplica tras una reconexion. */
  id: string;
  title: string;
  description: string;
  /** Verde para lo que avanza, rojo para lo que se cae, neutro para el resto. */
  tone: 'go' | 'danger' | 'neutral';
  /** A donde lleva el aviso al tocarlo. */
  href: string;
  at: string;
  read: boolean;
}

/** Las palabras del estado, las mismas del sello. No se inventan sinonimos. */
const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  OPEN: 'en espera',
  WASHING: 'lavando',
  READY: 'listo',
  PAID: 'cobrado',
  VOID: 'anulado',
};

/** `CW-0142` se grita como `#142` (RN-15). */
function referenceLabel(number: string): string {
  const sequence = Number(number.slice(number.indexOf('-') + 1));

  return `#${Number.isFinite(sequence) ? sequence : 0}`;
}

/** Quien lo hizo, para la segunda linea. Vacio si no se pudo atribuir. */
function byLabel(event: CarwashEvent): string {
  return event.actor === null ? '' : ` · ${event.actor.name}`;
}

function titleOf(event: CarwashEvent): { title: string; tone: Notification['tone'] } {
  const reference = referenceLabel(event.ticket.number);

  switch (event.type) {
    case 'ticket.created':
      return { title: `Entró ${reference}`, tone: 'neutral' };
    case 'ticket.status.changed':
      return {
        title: `${reference} pasó a ${STATUS_LABELS[event.ticket.status]}`,
        tone: event.ticket.status === 'READY' ? 'go' : 'neutral',
      };
    case 'ticket.assigned':
      return { title: `${reference} cambió de responsable`, tone: 'neutral' };
    case 'ticket.charged':
      return { title: `Se cobró ${reference}`, tone: 'go' };
    case 'ticket.reversed':
      return { title: `Se deshizo el cobro de ${reference}`, tone: 'danger' };
    case 'ticket.voided':
      return { title: `Se anuló ${reference}`, tone: 'danger' };
    case 'ticket.updated':
      return { title: `${reference} cambió`, tone: 'neutral' };
  }
}

/**
 * El detalle: la placa, mas el dato que le da sentido al titulo. La placa va
 * siempre porque es lo que el mostrador tiene a la vista, no el folio.
 */
function descriptionOf(event: CarwashEvent): string {
  const plate = event.ticket.vehicle.plate;
  const who = byLabel(event);

  if (event.type === 'ticket.charged') {
    return `${plate} · $${event.ticket.total}${who}`;
  }

  if (event.type === 'ticket.assigned') {
    const washer = event.ticket.washers[0];

    return `${plate} · ${washer === undefined ? 'sin asignar' : washer.fullName}`;
  }

  return `${plate}${who}`;
}

export function toNotification(event: CarwashEvent): Notification {
  const { title, tone } = titleOf(event);

  return {
    id: event.id,
    title,
    description: descriptionOf(event),
    tone,
    href: `/carwash/${event.ticket.id}`,
    at: event.at,
    read: false,
  };
}

/**
 * Si el aviso le corresponde a quien mira.
 *
 * Nadie necesita que le avisen de lo que acaba de hacer: la pantalla ya se lo
 * mostro, y un contador que sube con cada clic propio deja de significar algo.
 */
export function isWorthNotifying(event: CarwashEvent, viewerId: string | null): boolean {
  return event.actor === null || event.actor.id !== viewerId;
}
