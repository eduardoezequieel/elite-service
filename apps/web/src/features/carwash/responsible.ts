import type { Customer, Ticket } from '@elite/shared';

/** El responsable del carro, si hay uno: el del ticket o el dueño vigente. */
export function responsibleOf(ticket: Ticket): Customer | null {
  return ticket.customer ?? ticket.vehicle.currentOwner;
}

/** Texto para listas: el nombre, o «Sin responsable». */
export function responsibleLabel(ticket: Ticket): string {
  return responsibleOf(ticket)?.fullName ?? 'Sin responsable';
}
