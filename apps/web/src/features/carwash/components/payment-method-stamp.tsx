import type { PaymentMethod } from '@elite/shared';
import { ArrowLeftRight, Banknote, CreditCard, type LucideIcon } from 'lucide-react';

import { Stamp } from '@/components/ui/stamp';
import { METHOD_STAMP } from '../cash-format';

const ICONS: Record<PaymentMethod, LucideIcon> = {
  CASH: Banknote,
  CARD: CreditCard,
  TRANSFER: ArrowLeftRight,
};

/**
 * El método de un cobro, siempre con la palabra.
 *
 * Efectivo es el verde de «está en el cajón»; tarjeta informa; transferencia
 * es ámbar porque no se cuenta a mano.
 */
export function PaymentMethodStamp({ method }: { method: PaymentMethod }) {
  const { label, tone } = METHOD_STAMP[method];
  const Icon = ICONS[method];

  return <Stamp tone={tone} label={label} icon={<Icon strokeWidth={1.5} />} />;
}
