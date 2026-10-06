import type { PaymentMethod } from '@elite/shared';
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
