/**
 * Cómo se lee una venta suelta en la lista y en su ficha (065): la hora, la
 * fecha, el resumen de productos y los métodos. Sin React, para probarlo.
 */

import type { CounterSale, CounterSaleItem, PaymentMethod } from '@elite/shared';

import { CIVIL_TZ } from '@/lib/civil-date';

import { centsOf } from '../carwash/cash-format';
import { referenceOf } from '../carwash/reference';

import { formatQuantity, toMilli } from './sale-cart';

const TIME = new Intl.DateTimeFormat('es-SV', {
  timeZone: CIVIL_TZ,
  hour: 'numeric',
  minute: '2-digit',
});

const DATE = new Intl.DateTimeFormat('es-SV', {
  timeZone: CIVIL_TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** Según la versión de ICU, «a. m.» viene con espacio fino o duro: se compacta. */
function compactMeridiem(text: string): string {
  return text
    .replaceAll(/[\u202f\u00a0]/gu, ' ')
    .replace('a. m.', 'a.m.')
    .replace('p. m.', 'p.m.');
}

/** «9:42 a.m.», en la hora del taller y no en la del navegador. */
export function saleTime(iso: string): string {
  return compactMeridiem(TIME.format(new Date(iso)));
}

/** «Sábado, 26 de septiembre de 2026», en la hora del taller. */
export function saleDate(iso: string): string {
  const text = DATE.format(new Date(iso));

  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** «Cera en pasta ×2, Aromatizante ×1». */
export function productsSummary(
  items: readonly Pick<CounterSaleItem, 'name' | 'quantity'>[],
): string {
  return items.map((item) => `${item.name} ×${formatQuantity(toMilli(item.quantity))}`).join(', ');
}

/**
 * Los lavados cobrados en la misma cuenta que la venta (066), como se gritan
 * en la bahía: «#7, #8». `null` si la venta se cobró sola.
 */
export function accountTicketRefs(
  tickets: readonly { id: string; number: string }[],
): { id: string; label: string }[] | null {
  if (tickets.length === 0) return null;

  return tickets.map((ticket) => ({ id: ticket.id, label: `#${referenceOf(ticket.number)}` }));
}

/** «Cobrada con #7, #8», en texto plano. `null` si la venta se cobró sola. */
export function accountTicketsLabel(tickets: readonly { id: string; number: string }[]): string | null {
  const refs = accountTicketRefs(tickets);

  return refs === null ? null : `Cobrada con ${refs.map((ref) => ref.label).join(', ')}`;
}

/** Los métodos de los pagos, cada uno una vez y en el orden en que entraron. */
export function paymentMethodsOf(payments: readonly { method: PaymentMethod }[]): PaymentMethod[] {
  const methods: PaymentMethod[] = [];

  for (const payment of payments) {
    if (!methods.includes(payment.method)) methods.push(payment.method);
  }

  return methods;
}

/** Lo que el día suma en la cabecera de la lista. Las anuladas no cuentan como vendido. */
export interface SalesDaySummary {
  paidCount: number;
  voidCount: number;
  soldCents: number;
  cashCents: number;
}

export function summarizeSales(sales: readonly CounterSale[]): SalesDaySummary {
  let paidCount = 0;
  let voidCount = 0;
  let soldCents = 0;
  let cashCents = 0;

  for (const sale of sales) {
    if (sale.status === 'VOID') {
      voidCount += 1;
      continue;
    }

    paidCount += 1;
    soldCents += centsOf(sale.total) ?? 0;
    cashCents += sale.payments
      .filter((payment) => payment.method === 'CASH')
      .reduce((sum, payment) => sum + (centsOf(payment.amount) ?? 0), 0);
  }

  return { paidCount, voidCount, soldCents, cashCents };
}
