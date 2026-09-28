/**
 * Lo que un lavado dice de su cobro, ahora que el cobro es una cuenta (059).
 *
 * `Ticket.payment` era uno y ya no existe: un lavado tiene `payments` —lo que
 * le tocó a **él**, vacío mientras no se cobra, varios cuando el pago se
 * partió— y `charge`, la cuenta que lo cobró. Las pantallas no arman estas
 * frases cada una por su lado: salen de acá, sin React y con su prueba.
 */

import type { TicketChargeRef, TicketPayment } from '@elite/shared';

import { parseCents } from '@/lib/money';

import { METHOD_LABELS } from './cash-format';

/** `true` cuando el lavado ya tiene plata registrada. */
export function isCharged(payments: readonly TicketPayment[]): boolean {
  return payments.length > 0;
}

/**
 * Los métodos con los que se pagó, en una sola frase: «Efectivo», «Efectivo +
 * Tarjeta». Sin cobrar todavía, `null`: no se inventa un método.
 *
 * Un método repetido no se repite en el texto —dos renglones en efectivo del
 * mismo cobro siguen siendo «Efectivo»— y el orden es el del cobro.
 */
export function paymentMethodsLabel(payments: readonly TicketPayment[]): string | null {
  if (payments.length === 0) return null;

  const seen: string[] = [];

  for (const payment of payments) {
    const label = METHOD_LABELS[payment.method];
    if (!seen.includes(label)) seen.push(label);
  }

  return seen.join(' + ');
}

/** Lo que este lavado dejó en la caja, en centavos. */
export function paymentsTotalCents(payments: readonly TicketPayment[]): number {
  return payments.reduce((sum, payment) => sum + parseCents(payment.amount), 0);
}

/**
 * Cuándo se cobró: la primera fila de pago. Las de una misma cuenta se escriben
 * en la misma transacción, así que cualquiera sirve; la primera es la estable.
 */
export function paidAtOf(payments: readonly TicketPayment[]): string | null {
  return payments[0]?.paidAt ?? null;
}

/**
 * Que el cobro fue mancomunado, dicho en la ficha del lavado: con otros
 * lavados, con productos sueltos (066) o con las dos cosas. `null` cuando la
 * cuenta es solo este lavado, que es el caso normal y no necesita aclaración.
 */
export function jointChargeLabel(charge: TicketChargeRef | null): string | null {
  if (charge === null) return null;

  const others = charge.ticketCount - 1;
  const washes = others <= 0 ? null : others === 1 ? 'otro lavado' : `otros ${others} lavados`;
  const sale = charge.counterSale === null ? null : `la venta ${charge.counterSale.number}`;

  if (washes === null && sale === null) return null;

  return `Cobrado junto con ${[washes, sale].filter((part) => part !== null).join(' y ')}`;
}

/**
 * El aviso de que deshacer este cobro deshace el resto de la cuenta (RN-8,
 * 066): los otros lavados vuelven a listo y la venta suelta se anula. No se
 * deshace una parte sola.
 */
export function voidChargeWarning(charge: TicketChargeRef | null): string | null {
  if (charge === null) return null;

  const sale = charge.counterSale;

  if (charge.ticketCount <= 1) {
    return sale === null
      ? null
      : `Este cobro incluye la venta ${sale.number}. Se deshace la cuenta entera: la venta se anula y sus productos vuelven al inventario.`;
  }

  const washes = `Este cobro incluye ${charge.ticketCount} lavados`;

  return sale === null
    ? `${washes}. Se deshace la cuenta entera: los ${charge.ticketCount} vuelven a listo.`
    : `${washes} y la venta ${sale.number}. Se deshace la cuenta entera: los ${charge.ticketCount} vuelven a listo y la venta se anula.`;
}
