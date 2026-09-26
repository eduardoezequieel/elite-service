import type {
  CarwashEvent,
  CarwashEventActor,
  InventoryLowStockEvent,
  WorkOrderStatus,
} from '@elite/shared';

import { quantityLabel, quantityWithUnit, toMilli } from '@/features/carwash/product-lines';

/**
 * De evento a aviso legible (spec 042).
 *
 * Logica pura y sin React a proposito: el texto de una notificacion es lo que
 * alguien lee de reojo mientras atiende a un cliente, y merece un test, no una
 * revision visual.
 */

/**
 * El tipo de aviso, para recortar la bandeja (058).
 *
 * Se guarda con el aviso en vez de deducirse del titulo: el filtro es un dato,
 * no una cadena que haya que volver a leer. `cash` ademas decide quien lo
 * recibe —solo `carwash.cash`—, asi que tiene que ser explicito. `stock` es el
 * aviso de minimo del inventario (065) y lo mismo: solo `inventory.read`.
 */
export type NotificationKind = 'in' | 'move' | 'cash' | 'void' | 'stock';

/** Lo que ve el usuario en la bandeja. */
export interface Notification {
  /** El id del evento. Es lo que deduplica tras una reconexion. */
  id: string;
  title: string;
  description: string;
  /** Verde para lo que avanza, rojo para lo que se cae, neutro para el resto. */
  tone: 'go' | 'danger' | 'neutral';
  /** El grupo por el que se filtra en el cajon (058). */
  kind: NotificationKind;
  /**
   * Quien lo movió y desde dónde: «Carlos · pista». Renglón propio, nunca
   * pegado a la placa: un nombre al lado de una placa se lee como «el que lo
   * lavó», y acá significa «el que lo hizo». `null` si no se pudo atribuir.
   */
  by: string | null;
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

/**
 * Quien lo hizo y desde qué mundo.
 *
 * El «desde dónde» no sobra: oficina y pista pueden mover el mismo lavado, así
 * que sin eso el aviso obliga a adivinar si el carro lo movió quien lo está
 * lavando o quien está en el mostrador.
 */
function byLabel(event: { actor: CarwashEventActor | null }): string | null {
  if (event.actor === null) return null;

  return `${event.actor.name} · ${event.actor.kind === 'employee' ? 'pista' : 'oficina'}`;
}

/** De evento a grupo del filtro. Un caso por tipo: nada de adivinar. */
function kindOf(event: CarwashEvent): NotificationKind {
  switch (event.type) {
    case 'ticket.created':
      return 'in';
    case 'ticket.charged':
    case 'ticket.reversed':
      return 'cash';
    case 'ticket.voided':
      return 'void';
    default:
      return 'move';
  }
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
 * El detalle: la placa, más el dato que le da sentido al título. La placa va
 * siempre porque es lo que el mostrador tiene a la vista, no el folio.
 *
 * Quién lo hizo **no** va acá: tiene su propio renglón (`by`).
 */
function descriptionOf(event: CarwashEvent): string {
  const plate = event.ticket.vehicle.plate;

  if (event.type === 'ticket.charged') {
    return `${plate} · $${event.ticket.total}`;
  }

  if (event.type === 'ticket.assigned') {
    const washer = event.ticket.washers[0];

    // Acá hay dos personas —quien reasignó y a quién le quedó—, así que la de
    // este renglón se nombra con todas las letras.
    return washer === undefined
      ? `${plate} · quedó sin asignar`
      : `${plate} · ahora a cargo de ${washer.fullName}`;
  }

  return plate;
}

export function toNotification(event: CarwashEvent): Notification {
  const { title, tone } = titleOf(event);

  return {
    id: event.id,
    title,
    description: descriptionOf(event),
    by: byLabel(event),
    tone,
    kind: kindOf(event),
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

/**
 * El aviso de mínimo del inventario (065 RN-13): «Cera en pasta se está
 * acabando» y, abajo, «quedan 4 unidades (mínimo 5)».
 *
 * No lleva placa —no hay lavado— y lleva al artículo, donde está el kardex que
 * explica por qué bajó. Rojo porque es lo que hay que resolver antes de que
 * falte, y siempre con la palabra: el color no dice solo.
 */
export function toStockNotification(event: InventoryLowStockEvent): Notification {
  const stock = toMilli(event.stockOnHand);

  return {
    id: event.id,
    title: `${event.name} se está acabando`,
    description: `quedan ${quantityWithUnit(stock, event.unit)} (mínimo ${quantityLabel(
      toMilli(event.minStock),
    )})`,
    by: byLabel(event),
    tone: 'danger',
    kind: 'stock',
    href: `/inventory/${event.itemId}`,
    at: event.at,
    read: false,
  };
}
