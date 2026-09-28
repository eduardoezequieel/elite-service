import type { PaymentMethod, TicketPayment } from '@elite/shared';
import { ArrowLeftRight, Banknote, CreditCard, Wallet, type LucideIcon } from 'lucide-react';

import { Stamp } from '@/components/ui/stamp';
import { METHOD_STAMP } from '../cash-format';

/** El icono de cada método: el mismo en el sello y donde va solo (ventas). */
export const METHOD_ICONS: Record<PaymentMethod, LucideIcon> = {
  CASH: Banknote,
  CARD: CreditCard,
  TRANSFER: ArrowLeftRight,
  OTHER: Wallet,
};

/**
 * El método de un cobro, siempre con la palabra.
 *
 * Efectivo es el verde de «está en el cajón»; tarjeta informa; transferencia
 * es ámbar porque no se cuenta a mano; «Otro» (069) es neutro.
 */
export function PaymentMethodStamp({ method }: { method: PaymentMethod }) {
  const { label, tone } = METHOD_STAMP[method];
  const Icon = METHOD_ICONS[method];

  return <Stamp tone={tone} label={label} icon={<Icon strokeWidth={1.5} />} />;
}

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
