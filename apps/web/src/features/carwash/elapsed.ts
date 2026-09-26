import type { Ticket } from '@elite/shared';

import { durationLabel, secondsSince } from './duration';
import { paidAtOf } from './ticket-payments';

/**
 * Cuánto estuvo el carro en el taller (053).
 *
 * Un solo significado para el número de la columna «Entrada»: el tiempo desde
 * que el carro entró. Antes se medía desde `washingStartedAt`, así que un
 * lavado que volvió a la bahía decía «4 min» aunque llevara una hora adentro y
 * la línea de tiempo dijera otra cosa.
 *
 * - `PAID` congela en `createdAt → la hora del cobro`: cerrado es cerrado.
 * - `VOID` no devuelve nada: un lavado anulado no duró, se canceló.
 * - El resto cuenta contra `now`.
 *
 * El vocabulario es el de `duration.ts`, el mismo de la línea de tiempo: por
 * eso los dos números cuadran.
 */
export function elapsedLabel(
  ticket: Pick<Ticket, 'status' | 'createdAt' | 'payments'>,
  now: number,
): string | null {
  if (ticket.status === 'VOID') return null;

  // El cobro puede venir partido en varios métodos (059): todos se escriben en
  // la misma transacción, así que la hora del cobro es la de la primera fila.
  const paidAt = paidAtOf(ticket.payments);

  if (ticket.status === 'PAID' && paidAt !== null) {
    return durationLabel(secondsSince(ticket.createdAt, new Date(paidAt).getTime()));
  }

  return durationLabel(secondsSince(ticket.createdAt, now));
}
