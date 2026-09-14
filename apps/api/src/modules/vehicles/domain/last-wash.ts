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
