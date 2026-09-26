import type { LastWash, PaymentMethod, TicketItemKind } from '@elite/shared';

// Dinero prestado del dominio de carwash (057): el desglose que viaja en la
// ficha es la misma factura que muestra el ticket, y dos formateadores distintos
// terminarían mostrando "$8" de un lado y "$8.00" del otro. Es dominio puro —sin
// Prisma ni Nest—, así que la regla de capas se mantiene.
import { fromDecimalString, toDecimalString } from '../../carwash/domain/money';
import { lineTotal } from '../../carwash/domain/pricing';
import { fromQuantityString, toQuantityString } from '../../inventory/domain/stock';

/** Una línea del ticket candidato, con el precio tal como lo guarda la base. */
export interface LastWashItemSource {
  kind: TicketItemKind;
  serviceName: string;
  /** Cadena decimal (`"8.00"`), como la entrega la base. */
  unitPrice: string;
  /** Tres decimales (`"2.000"`); un servicio lleva `"1.000"` (065 RN-6). */
  quantity: string;
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
  /**
   * Los pagos de ese lavado, del mas viejo al mas nuevo. Vacio si todavia no
   * se cobro; mas de uno cuando el cobro se partio en metodos (059).
   */
  payments: readonly { method: PaymentMethod; paidAt: Date }[];
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
  // Cada linea es `precio × cantidad` redondeado al centavo, la misma cuenta
  // del ticket (065 RN-6): sumar solo `unitPrice` cobraba un producto 2 × $3
  // como si fuera uno.
  const lines = order.items.map((item) => {
    const unitPrice = fromDecimalString(item.unitPrice);
    const quantity = fromQuantityString(item.quantity);
    return { item, unitPrice, quantity, total: lineTotal(unitPrice, quantity) };
  });

  return {
    id: order.id,
    number: order.number,
    createdAt: order.createdAt.toISOString(),
    washers: order.washers.map((washer) => washer.fullName),
    items: lines.map((line) => ({
      kind: line.item.kind,
      serviceName: line.item.serviceName,
      unitPrice: toDecimalString(line.unitPrice),
      quantity: toQuantityString(line.quantity),
      total: toDecimalString(line.total),
    })),
    total: toDecimalString(lines.reduce((sum, line) => sum + line.total, 0)),
    // Todos los pagos, del mas viejo al mas nuevo: un cobro partido se
    // resume con sus dos metodos, no con el primero (059).
    payments: order.payments.map((payment) => ({
      method: payment.method,
      paidAt: payment.paidAt.toISOString(),
    })),
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
