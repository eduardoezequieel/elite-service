import type { Ticket, TicketWasher } from '@elite/shared';

/** Nombre de pila: lo que cabe en un chip de la bahía. */
export function givenName(fullName: string): string {
  const [first] = fullName.trim().split(/\s+/);

  return first === undefined || first === '' ? fullName : first;
}

/**
 * Cómo se nombra el asignado en la fila: «Sin asignar», un nombre, o
 * «Carlos +1» si el ticket es viejo con varios (035).
 */
export function washersLabel(ticket: Pick<Ticket, 'washers'>): string {
  const { washers } = ticket;

  if (washers.length === 0) return 'Sin asignar';
  if (washers.length === 1) return washers[0]?.fullName ?? 'Sin asignar';

  const first = washers[0] as TicketWasher;

  return `${givenName(first.fullName)} +${washers.length - 1}`;
}

export function washerNames(washers: readonly TicketWasher[]): string {
  if (washers.length === 0) return 'Sin asignar';

  return washers.map((washer) => washer.fullName).join(', ');
}
