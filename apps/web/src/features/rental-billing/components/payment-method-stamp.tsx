import { PAYMENT_METHOD_LABELS } from '@elite/shared';
import type { PaymentMethod } from '@elite/shared';

import { Stamp, type StampTone } from '@/components/ui/stamp';

/** Efectivo en verde (está en la caja), tarjeta informativa, transferencia por confirmar. */
const TONES: Record<PaymentMethod, StampTone> = {
  CASH: 'green',
  CARD: 'blue',
  TRANSFER: 'amber',
  OTHER: 'neutral',
};

/** La forma de pago de un cobro de renta (098). Un anulado dice «Anulado». */
export function RentalPaymentStamp({
  method,
  voided = false,
}: {
  method: PaymentMethod;
  voided?: boolean;
}) {
  if (voided) return <Stamp label="Anulado" tone="void" />;

  return <Stamp label={PAYMENT_METHOD_LABELS[method]} tone={TONES[method]} />;
}
