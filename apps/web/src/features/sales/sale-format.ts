/**
 * Cómo se lee una venta suelta en la lista y en su ficha (065): el resumen de
 * productos y los métodos. La hora y la fecha salen de `timeLabel` y `dayLabel`
 * de `lib/civil-date` (076). Sin React, para probarlo.
 */

import type { CounterSale, CounterSaleItem, PaymentMethod, SalesFeedEntry } from '@elite/shared';

import { toCents } from '@/lib/money';
import { formatQuantity } from '@/lib/quantity';

import { referenceOf } from '../carwash/reference';

/** «Cera en pasta ×2, Aromatizante ×1». */
export function productsSummary(
  items: readonly Pick<CounterSaleItem, 'name' | 'quantity'>[],
): string {
  return items.map((item) => `${item.name} ×${formatQuantity(item.quantity)}`).join(', ');
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
export function accountTicketsLabel(
  tickets: readonly { id: string; number: string }[],
): string | null {
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
    soldCents += toCents(sale.total) ?? 0;
    cashCents += sale.payments
      .filter((payment) => payment.method === 'CASH')
      .reduce((sum, payment) => sum + (toCents(payment.amount) ?? 0), 0);
  }

  return { paidCount, voidCount, soldCents, cashCents };
}

// ---------------------------------------------------------------------------
// «Ventas del día» (106): ventas sueltas y abonos a cuentas abiertas
// ---------------------------------------------------------------------------

/** El filtro de «Ventas del día». «Pagadas» trae también los abonos: entraron a la caja. */
export type FeedFilter = 'all' | 'PAID' | 'VOID';

/** Lo que el día suma: lo de las ventas, más los abonos en efectivo y cuántos hubo. */
export interface FeedDaySummary extends SalesDaySummary {
  tabPaymentCount: number;
}

/**
 * Las cifras de arriba. «Vendido» son las ventas sueltas cobradas: un abono no
 * es una venta, es plata de algo que se anotó antes. «En efectivo» sí lo
 * cuenta, porque es lo que entró a la gaveta.
 */
export function summarizeFeed(entries: readonly SalesFeedEntry[]): FeedDaySummary {
  const sales = entries.flatMap((entry) => (entry.kind === 'SALE' ? [entry.sale] : []));
  const summary = summarizeSales(sales);
  let tabPaymentCount = 0;
  let cashCents = summary.cashCents;

  for (const entry of entries) {
    if (entry.kind !== 'TAB_PAYMENT') continue;

    tabPaymentCount += 1;
    if (entry.tabPayment.method === 'CASH') cashCents += toCents(entry.tabPayment.amount) ?? 0;
  }

  return { ...summary, cashCents, tabPaymentCount };
}

/** Cuántas filas tiene cada filtro. */
export function feedFilterCount(summary: FeedDaySummary, filter: FeedFilter): number {
  if (filter === 'VOID') return summary.voidCount;
  if (filter === 'PAID') return summary.paidCount + summary.tabPaymentCount;

  return summary.paidCount + summary.voidCount + summary.tabPaymentCount;
}

/** Las filas que deja ver el filtro. */
export function filterFeed(
  entries: readonly SalesFeedEntry[],
  filter: FeedFilter,
): SalesFeedEntry[] {
  if (filter === 'all') return [...entries];

  return entries.filter((entry) =>
    entry.kind === 'TAB_PAYMENT' ? filter === 'PAID' : entry.sale.status === filter,
  );
}

/** Clave estable de una fila: una venta y un abono pueden compartir id de otra tabla. */
export function feedEntryKey(entry: SalesFeedEntry): string {
  return entry.kind === 'SALE' ? `sale:${entry.sale.id}` : `tab-payment:${entry.tabPayment.id}`;
}

/** A dónde lleva la fila: la venta, o la cuenta del abono. */
export function feedEntryHref(entry: SalesFeedEntry): string {
  return entry.kind === 'SALE'
    ? `/sales/${entry.sale.id}`
    : `/sales/tabs/${entry.tabPayment.tab.id}`;
}
