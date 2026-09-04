import type { Ticket, TicketWasher } from '@elite/shared';

/** Nombre de pila: lo que cabe en un chip de la bahía. */
export function givenName(fullName: string): string {
  const [first] = fullName.trim().split(/\s+/);

  return first === undefined || first === '' ? fullName : first;
}

/**
 * Cómo se nombra el conjunto en la fila de oficina: «Oficina», un nombre, o
 * «Carlos +1».
 */
export function washersLabel(ticket: Pick<Ticket, 'washers'>): string {
  const { washers } = ticket;

  if (washers.length === 0) return 'Oficina';
  if (washers.length === 1) return washers[0]?.fullName ?? 'Oficina';

  const first = washers[0] as TicketWasher;

  return `${givenName(first.fullName)} +${washers.length - 1}`;
}

export function washerNames(washers: readonly TicketWasher[]): string {
  if (washers.length === 0) return 'Oficina';

  return washers.map((washer) => washer.fullName).join(', ');
}
