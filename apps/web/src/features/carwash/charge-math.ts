/**
 * La aritmética de la cuenta de cobro (059): cuánto suma, cuánto falta, cuánto
 * se paga en efectivo, cuánto se devuelve y cómo se reparte entre los lavados.
 *
 * Vive suelta y sin React porque es la parte del cobro que se puede probar sin
 * montar el diálogo, y porque el reparto (RN-5) es una regla de negocio que el
 * API vuelve a aplicar: si las dos no dan lo mismo al centavo, el desplegable
 * «Cómo se registra por ticket» estaría mintiendo.
 *
 * Todo se mide en **centavos enteros**. El dinero viaja como cadena decimal
 * (`"14.00"`) justamente para no pasar por un `number` con coma flotante.
 */

import type { PaymentMethod } from '@elite/shared';

import { centsToAmount, parseCents } from '@/lib/money';

import { paymentDetailsBlocker, type PaymentDetailsDraft } from './payment-details';

/**
 * Un renglón del pago: un método, lo que entra por ahí, como lo teclea el
 * cajero, y los datos que pide el método (069: cuenta y referencia en una
 * transferencia, qué fue en «Otro»).
 */
export interface PaymentLine extends PaymentDetailsDraft {
  id: string;
  method: PaymentMethod;
  /** Cadena decimal, tal cual está en el campo. Vacía cuenta como cero. */
  amount: string;
}

/** Lo mínimo que la aritmética necesita de un lavado de la cuenta. */
export interface AccountTicket {
  id: string;
  /** Total del lavado, cadena decimal. */
  total: string;
}

/**
 * La parte de la venta suelta en el reparto (066). No es el id de nada: el API
 * pone la venta al final de las partes, y la pantalla la nombra así.
 */
export const SALE_BUCKET_ID = 'counter-sale';

/**
 * Las partes de la cuenta en el orden del API (066): cada lavado y, si la
 * cuenta lleva productos sueltos, la venta al final. Con productos en cero la
 * venta sigue siendo una parte, igual que en el API.
 */
export function accountBuckets(
  tickets: readonly AccountTicket[],
  saleCents: number | null,
): AccountTicket[] {
  const washes = tickets.map((ticket) => ({ id: ticket.id, total: ticket.total }));

  return saleCents === null
    ? washes
    : [...washes, { id: SALE_BUCKET_ID, total: centsToAmount(saleCents) }];
}

/** El total de la cuenta: la suma de las partes que se están cobrando (RN-3). */
export function accountTotalCents(tickets: readonly AccountTicket[]): number {
  return tickets.reduce((sum, ticket) => sum + parseCents(ticket.total), 0);
}

/** Lo que cubren los renglones de pago. */
export function paidCents(lines: readonly PaymentLine[]): number {
  return lines.reduce((sum, line) => sum + parseCents(line.amount), 0);
}

/** Positivo: falta plata. Negativo: se pasó. Cero: cuadra (RN-3). */
export function remainingCents(totalCents: number, lines: readonly PaymentLine[]): number {
  return totalCents - paidCents(lines);
}

export type BalanceKind = 'short' | 'even' | 'over';

/** Cómo va el reparto del pago partido, con la palabra que lo nombra. */
export function balanceOf(remaining: number): { kind: BalanceKind; label: string; cents: number } {
  if (remaining > 0) return { kind: 'short', label: 'Falta', cents: remaining };
  if (remaining < 0) return { kind: 'over', label: 'Se pasó', cents: -remaining };

  return { kind: 'even', label: 'Cuadra', cents: 0 };
}

/**
 * Lo que de verdad se cobra en efectivo: el total cuando el pago es uno solo y
 * en efectivo, o la suma de los renglones en efectivo cuando está partido.
 */
export function cashDueCents(input: {
  totalCents: number;
  split: boolean;
  lines: readonly PaymentLine[];
  method: PaymentMethod;
}): number {
  if (input.split) {
    return input.lines
      .filter((line) => line.method === 'CASH')
      .reduce((sum, line) => sum + parseCents(line.amount), 0);
  }

  return input.method === 'CASH' ? input.totalCents : 0;
}

/**
 * El vuelto (RN-10). Sin nada tecleado se asume pago justo y el cambio es cero:
 * el campo vacío no es un cero, es «no me dijo con cuánto paga».
 */
export function changeCents(tendered: string, cashDue: number): number {
  const received = parseCents(tendered);

  if (tendered.trim() === '' || received === 0) return 0;

  return received - cashDue;
}

/** Lo recibido no alcanza para el efectivo a cobrar. El API responde `CASH_TENDERED_SHORT`. */
export function isCashShort(tendered: string, cashDue: number): boolean {
  const received = parseCents(tendered);

  return tendered.trim() !== '' && received > 0 && received < cashDue;
}

/**
 * Por qué no se puede cobrar todavía, con el texto que va en el botón. `null`
 * cuando se puede.
 *
 * Es lo último que se lee antes de una acción que no se deshace: el botón dice
 * qué falta, no «Cobrar» apagado sin explicación.
 */
export function chargeBlocker(input: {
  totalCents: number;
  split: boolean;
  lines: readonly PaymentLine[];
  tendered: string;
  cashDue: number;
  /** El método del pago único. Sin él no se revisan sus datos (069). */
  method?: PaymentMethod;
  /** Los datos del pago único: cuenta y referencia, o qué fue (069). */
  details?: PaymentDetailsDraft;
  /** Las cuentas activas: la elegida tiene que estar entre ellas (069). */
  bankAccountIds?: readonly string[];
}): string | null {
  if (input.totalCents <= 0) return 'Nada que cobrar';

  if (input.split) {
    const balance = balanceOf(remainingCents(input.totalCents, input.lines));

    if (balance.kind === 'short') return `Falta $${centsToAmount(balance.cents)}`;
    if (balance.kind === 'over') return `Se pasó por $${centsToAmount(balance.cents)}`;

    for (const line of input.lines) {
      const missing = paymentDetailsBlocker(line.method, line, input.bankAccountIds);

      if (missing !== null) return missing;
    }
  } else if (input.method !== undefined) {
    const missing = paymentDetailsBlocker(input.method, input.details ?? {}, input.bankAccountIds);

    if (missing !== null) return missing;
  }

  if (isCashShort(input.tendered, input.cashDue)) return 'Falta efectivo';

  return null;
}

/**
 * Reajusta los renglones cuando cambia el total de la cuenta —se sumó un
 * lavado, se quitó uno, se autorizó un precio—: la diferencia entera cae en el
 * **último** renglón, que es el que el cajero estaba por teclear. Nunca baja de
 * cero: si la cuenta se achica más de lo que cubre ese renglón, el resto queda
 * como «Se pasó» y lo arregla la persona.
 */
export function fitLastLine(lines: readonly PaymentLine[], totalCents: number): PaymentLine[] {
  if (lines.length === 0) return [...lines];

  const left = remainingCents(totalCents, lines);
  const lastIndex = lines.length - 1;

  return lines.map((line, index) =>
    index === lastIndex
      ? { ...line, amount: centsToAmount(Math.max(0, parseCents(line.amount) + left)) }
      : { ...line },
  );
}

/** Lo que le toca a cada lavado de un monto cobrado. */
export interface TicketShare {
  ticketId: string;
  cents: number;
}

/**
 * El reparto por lavado (RN-5).
 *
 * Proporcional al total de cada lavado, con los centavos que no dividen exacto
 * al de **mayor resto**. La suma de las partes es siempre exactamente el monto
 * repartido: ni un centavo perdido ni inventado. Es automático — el cajero no
 * reparte nada a mano— y es el mismo criterio que aplica el API.
 *
 * Con una cuenta de total cero (lavados de cortesía) no hay proporción posible:
 * el sobrante cae en el primero, que sigue cumpliendo que la suma cuadre.
 */
export function spreadCents(cents: number, tickets: readonly AccountTicket[]): TicketShare[] {
  if (tickets.length === 0) return [];

  const base = accountTotalCents(tickets);
  const exact = tickets.map((ticket) =>
    base === 0 ? 0 : (cents * parseCents(ticket.total)) / base,
  );
  const shares = tickets.map((ticket, index) => ({
    ticketId: ticket.id,
    cents: Math.floor(exact[index] ?? 0),
  }));

  let left = cents - shares.reduce((sum, share) => sum + share.cents, 0);
  // Mayor resto primero. El orden de la cuenta desempata, y `sort` es estable:
  // dos lavados con el mismo resto reciben el centavo en el orden en que
  // entraron, no al azar.
  const order = exact
    .map((value, index) => ({ index, rest: value - Math.floor(value) }))
    .sort((a, b) => b.rest - a.rest);

  for (let step = 0; left > 0; step += 1, left -= 1) {
    const target = order[step % order.length];
    const share = target === undefined ? undefined : shares[target.index];

    if (share !== undefined) share.cents += 1;
  }

  return shares;
}
