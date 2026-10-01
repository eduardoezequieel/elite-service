import type { RentalPayment } from '@elite/shared';

import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

/** El monto, tachado si se anuló, con el motivo al lado y sin raya (DESIGN.md). */
export function PaymentAmount({ payment }: { payment: RentalPayment }) {
  const voided = payment.voidedAt !== null;

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <span className={cn('text-text font-mono tabular-nums', voided && 'is-ruled-out')}>
        {formatMoney(payment.amount)}
      </span>
      {voided ? (
        <span className="text-text-dim text-label">
          Anulado por {payment.voidedByName ?? 'alguien'}: {payment.voidReason}
        </span>
      ) : null}
    </span>
  );
}
