import type { LastWash, PaymentMethod } from '@elite/shared';

// Dinero prestado del dominio de carwash (057): el desglose que viaja en la
// ficha es la misma factura que muestra el ticket, y dos formateadores distintos
// terminarían mostrando "$8" de un lado y "$8.00" del otro. Es dominio puro —sin
// Prisma ni Nest—, así que la regla de capas se mantiene.
import { fromDecimalString, toDecimalString } from '../../carwash/domain/money';

/** Una línea del ticket candidato, con el precio tal como lo guarda la base. */
export interface LastWashItemSource {
  serviceName: string;
  /** Cadena decimal (`"8.00"`), como la entrega la base. */
  unitPrice: string;
}

/** Un ticket candidato a `lastWash`: el más reciente no anulado del carro. */
export interface LastWashSource {
  id: string;
  number: string;
  createdAt: Date;
  notes: string | null;
  /** Todas las líneas del ticket, en el orden en que se cobraron. */
  items: readonly LastWashItemSource[];
  /** Quiénes lo lavaron. Vacío si lo hizo oficina. */
  washers: readonly { fullName: string }[];
  payment: { method: PaymentMethod; paidAt: Date } | null;
}

/**
 * El mismo candidato, con el id con el que se descarta el ticket propio (052).
 *
 * Desde la 057 el id es parte del contrato, así que ya no agrega nada: el alias
 * queda porque es el nombre con el que se lee la lista que recibe
 * `lastWashBefore`.
 */
export type IdentifiedLastWashSource = LastWashSource;

/**
 * Arma el `lastWash` del contrato (041, 057): la factura resumida de ese
 * lavado. Sin ticket, `null`. Notas en blanco tampoco se inventan: van `null`
 * para que la ficha no pinte un bloque vacío.
 *
 * El total se suma en centavos y recién ahí se formatea: sumar cadenas
 * decimales como `number` es el error que el módulo `money` existe para evitar.
 * Y se suma acá en vez de copiarse del ticket porque el ticket tampoco lo
 * guarda: se recalcula al leer (ver `toTicket`).
 */
export function lastWashOf(order: LastWashSource | undefined): LastWash | null {
  if (order === undefined) return null;

  const trimmed = order.notes?.trim() ?? '';
  const cents = order.items.map((item) => fromDecimalString(item.unitPrice));

  return {
    id: order.id,
    number: order.number,
    createdAt: order.createdAt.toISOString(),
    washers: order.washers.map((washer) => washer.fullName),
    items: order.items.map((item, index) => ({
      serviceName: item.serviceName,
      unitPrice: toDecimalString(cents[index]),
    })),
    total: toDecimalString(cents.reduce((sum, price) => sum + price, 0)),
    payment:
      order.payment === null
        ? null
        : { method: order.payment.method, paidAt: order.payment.paidAt.toISOString() },
    notes: trimmed === '' ? null : trimmed,
  };
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
