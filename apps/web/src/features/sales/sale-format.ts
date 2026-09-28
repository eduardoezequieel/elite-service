/**
 * Cómo se lee una venta suelta en la lista y en su ficha (065): el resumen de
 * productos y los métodos. La hora y la fecha salen de `timeLabel` y `dayLabel`
 * de `lib/civil-date` (076). Sin React, para probarlo.
 */

import type { CounterSale, CounterSaleItem, PaymentMethod } from '@elite/shared';

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
