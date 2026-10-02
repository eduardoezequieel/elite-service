import type {
  PaymentMethod,
  Ticket,
  TicketListFacets,
  TicketListSummary,
  WorkOrderStatus,
} from '@elite/shared';
import { TICKET_PAYMENT_PENDING, TICKET_WASHER_NONE } from '@elite/shared';

import { fromDecimalString, toDecimalString, type Cents } from './money';

/**
 * Lo que cuenta y recorta la lista de lavados de oficina (102). Antes lo hacía
 * la pantalla sobre el día entero; con la lista paginada en el servidor, la
 * regla vive acá —pura— y el repositorio solo la alimenta.
 *
 * Tres alcances distintos sobre la misma base (el día, o el historial del
 * cliente):
 *
 * - `summary`: la base entera, sin estado, búsqueda ni filtros.
 * - `facets`: la base con estado y búsqueda, antes de los filtros del popover.
 * - la página: todo junto, recortado.
 */

/** Los filtros del popover «Filtros» de la lista. */
export interface TicketListFilters {
  bodyTypeId?: string;
  /** `serviceId` de la línea o, si no tiene servicio enlazado, su nombre. */
  serviceId?: string;
  /** `none` = sin empleado. */
  washerId?: string;
  /** `pending` = sin pagos; un método = algún pago con ese método. */
  payment?: string;
}

/** Lo mínimo de un lavado para contar el resumen y armar las opciones. */
export interface TicketDigest {
  status: WorkOrderStatus;
  totalCents: Cents;
  bodyType: { id: string; name: string };
  /** Solo las líneas `SERVICE` (065): un producto no es un servicio. */
  serviceLines: { serviceId: string | null; serviceName: string }[];
  washers: { id: string; fullName: string }[];
  paymentMethods: PaymentMethod[];
}

export function digestOfTicket(ticket: Ticket): TicketDigest {
  return {
    status: ticket.status,
    totalCents: fromDecimalString(ticket.total),
    bodyType: { id: ticket.bodyType.id, name: ticket.bodyType.name },
    serviceLines: ticket.items
      .filter((item) => item.kind === 'SERVICE')
      .map((item) => ({ serviceId: item.serviceId, serviceName: item.serviceName })),
    washers: ticket.washers.map((washer) => ({ id: washer.id, fullName: washer.fullName })),
    paymentMethods: ticket.payments.map((payment) => payment.method),
  };
}

/** El valor con que el filtro «Servicio» reconoce una línea. */
export function serviceFilterValue(line: { serviceId: string | null; serviceName: string }) {
  return line.serviceId ?? line.serviceName;
}

export function matchesTicketFilters(ticket: TicketDigest, filters: TicketListFilters): boolean {
  if (filters.bodyTypeId !== undefined && ticket.bodyType.id !== filters.bodyTypeId) return false;
  if (
    filters.serviceId !== undefined &&
    !ticket.serviceLines.some((line) => serviceFilterValue(line) === filters.serviceId)
  ) {
    return false;
  }
  if (filters.washerId !== undefined) {
    if (filters.washerId === TICKET_WASHER_NONE) {
      if (ticket.washers.length > 0) return false;
    } else if (!ticket.washers.some((washer) => washer.id === filters.washerId)) {
      return false;
    }
  }
  if (filters.payment !== undefined) {
    // Un lavado puede tener varios pagos (059): «Tarjeta» trae el que se pagó
    // en parte con tarjeta.
    if (filters.payment === TICKET_PAYMENT_PENDING) {
      if (ticket.paymentMethods.length > 0) return false;
    } else if (!ticket.paymentMethods.includes(filters.payment as PaymentMethod)) {
      return false;
    }
  }

  return true;
}

export function summarizeTickets(tickets: readonly TicketDigest[]): TicketListSummary {
  let queued = 0;
  let ready = 0;
  let paidCount = 0;
  let paidCents = 0;
  let nonVoid = 0;

  for (const ticket of tickets) {
    if (ticket.status !== 'VOID') nonVoid += 1;
    if (ticket.status === 'OPEN' || ticket.status === 'WASHING') queued += 1;
    if (ticket.status === 'READY') ready += 1;
    if (ticket.status === 'PAID') {
      paidCount += 1;
      paidCents += ticket.totalCents;
    }
  }

  return {
    queued,
    ready,
    paidCount,
    paidTotal: toDecimalString(paidCents),
    nonVoid,
    all: tickets.length,
  };
}

/** Primera aparición de cada valor, en el orden de las filas. */
function unique<T>(items: readonly T[], keyOf: (item: T) => string): T[] {
  const seen = new Map<string, T>();

  for (const item of items) {
    const key = keyOf(item);
    if (key !== '' && !seen.has(key)) seen.set(key, item);
  }

  return [...seen.values()];
}

export function ticketFacets(tickets: readonly TicketDigest[]): TicketListFacets {
  return {
    bodyTypes: unique(
      tickets.map((ticket) => ticket.bodyType),
      (bodyType) => bodyType.id,
    ),
    services: unique(
      tickets.flatMap((ticket) => ticket.serviceLines),
      serviceFilterValue,
    ).map((line) => ({ value: serviceFilterValue(line), label: line.serviceName })),
    washers: unique(
      tickets.flatMap((ticket) => ticket.washers),
      (washer) => washer.id,
    ),
    hasUnassigned: tickets.some((ticket) => ticket.washers.length === 0),
  };
}
