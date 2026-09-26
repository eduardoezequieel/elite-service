import type { Ticket } from '@elite/shared';

import { paidAtOf } from './ticket-payments';

/**
 * Desde cuándo el lavado está en su estado actual (064), para el estado grande
 * del detalle. Solo con lo que el ticket ya trae: la línea de tiempo lo sabe
 * mejor, pero pide `carwash.audit`.
 *
 * - `WASHING` → `washingStartedAt`; `READY` → `readyAt`; `PAID` → el cobro.
 * - `OPEN` → `createdAt`, pero solo si nunca salió de la cola. Uno reabierto
 *   (037) volvió a la cola en un momento que el ticket no guarda, y contar
 *   desde la entrada mentiría.
 * - `VOID` → nada: anulado no está «en» ningún lado.
 */
export function statusSinceOf(
  ticket: Pick<Ticket, 'status' | 'createdAt' | 'washingStartedAt' | 'readyAt' | 'payments'>,
): string | null {
  switch (ticket.status) {
    case 'OPEN':
      return ticket.washingStartedAt === null && ticket.readyAt === null ? ticket.createdAt : null;
    case 'WASHING':
      return ticket.washingStartedAt;
    case 'READY':
      return ticket.readyAt;
    case 'PAID':
      return paidAtOf(ticket.payments);
    case 'VOID':
      return null;
  }
}
