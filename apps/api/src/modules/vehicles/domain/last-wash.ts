import type { LastWash } from '@elite/shared';

/** Un ticket candidato a `lastWash`: el más reciente no anulado del carro. */
export interface LastWashSource {
  createdAt: Date;
  notes: string | null;
  items: readonly { serviceName: string }[];
}

/**
 * Arma el `lastWash` del contrato (041). Sin ticket, `null`. Notas en blanco
 * tampoco se inventan: van `null` para que la ficha no pinte un bloque vacío.
 */
export function lastWashOf(order: LastWashSource | undefined): LastWash | null {
  if (order === undefined) return null;

  const trimmed = order.notes?.trim() ?? '';

  return {
    createdAt: order.createdAt.toISOString(),
    serviceName: order.items[0]?.serviceName ?? null,
    notes: trimmed === '' ? null : trimmed,
  };
}

/** El mismo candidato, con el id con el que se descarta el ticket propio (052). */
export interface IdentifiedLastWashSource extends LastWashSource {
  id: string;
}

/**
 * El `lastWash` que viaja **dentro de un ticket** (052): el último lavado no
 * anulado del carro que no sea ese ticket.
 *
 * Visto desde el ticket abierto, el «último lavado» del carro era él mismo, y
 * a quien lava no le sirve la nota que acaba de escribir: necesita la de la vez
 * anterior. Los anulados ya quedaron fuera al consultar, así que acá solo se
 * salta el propio; el primer lavado de un carro no tiene anterior y da `null`.
 */
export function lastWashBefore(
  orders: readonly IdentifiedLastWashSource[],
  ticketId: string,
): LastWash | null {
  return lastWashOf(orders.find((order) => order.id !== ticketId));
}
