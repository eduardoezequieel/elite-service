import type { PaymentMethod, TicketPayment } from '@elite/shared';

import {
  METHOD_ICONS,
  PaymentMethodStamp,
} from '@/features/cash-shift/components/payment-method-stamp';

export { METHOD_ICONS, PaymentMethodStamp };

/**
 * Con qué se pagó un lavado (059). Un cobro puede venir partido en métodos, así
 * que son uno o varios sellos, nunca un texto que resuma: el sello es el que
 * lleva la palabra y el tono de cada método.
 *
 * Sin pagos no dibuja nada: un lavado sin cobrar no tiene método, y un sello
 * vacío diría que sí.
 */
export function TicketPaymentsStamp({ payments }: { payments: readonly TicketPayment[] }) {
  const methods: PaymentMethod[] = [];

  for (const payment of payments) {
    if (!methods.includes(payment.method)) methods.push(payment.method);
  }

  if (methods.length === 0) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {methods.map((method) => (
        <PaymentMethodStamp key={method} method={method} />
      ))}
    </span>
  );
}
