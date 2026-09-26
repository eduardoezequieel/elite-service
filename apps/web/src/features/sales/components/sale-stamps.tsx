import type { CounterSaleStatus, PaymentMethod } from '@elite/shared';
import { Ban, Banknote } from 'lucide-react';

import { Stamp } from '@/components/ui/stamp';
import { PaymentMethodStamp } from '@/features/carwash/components/payment-method-stamp';
import { paymentMethodsOf } from '../sale-format';

/**
 * El estado de una venta suelta: nace pagada y solo puede anularse (RN-18,
 * RN-22). Mismos tonos e iconos que el cobro de un lavado, para que «pagada» y
 * «anulada» se lean igual en todo el sistema.
 */
export function SaleStatusStamp({ status }: { status: CounterSaleStatus }) {
  return status === 'VOID' ? (
    <Stamp tone="void" label="Anulada" icon={<Ban />} />
  ) : (
    <Stamp tone="paid" label="Pagada" icon={<Banknote />} />
  );
}

/**
 * Con qué se pagó: un sello por método, como en el lavado (059). Una venta
 * anulada no tiene pagos —salieron del turno— y no dibuja nada.
 */
export function SalePaymentsStamp({
  payments,
}: {
  payments: readonly { method: PaymentMethod }[];
}) {
  const methods = paymentMethodsOf(payments);

  if (methods.length === 0) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {methods.map((method) => (
        <PaymentMethodStamp key={method} method={method} />
      ))}
    </span>
  );
}
