'use client';

import { PERMISSIONS } from '@elite/shared';
import type { RentalCashPayment } from '@elite/shared';

import { PlateChip } from '@/components/ui/plate-chip';
import type { CashShiftAdapter } from '@/features/cash-shift/adapter';

export const RENTAL_CASH_QUERY_KEY = ['rentals', 'cash'] as const;

function rentalDetailText(payment: RentalCashPayment): string | null {
  if (payment.method === 'TRANSFER' && payment.reference) return `Ref ${payment.reference}`;
  if (payment.method === 'OTHER' && payment.description) return payment.description;

  return null;
}

export const rentalCashAdapter: CashShiftAdapter<RentalCashPayment> = {
  basePath: '/rentals/cash',
  queryKey: RENTAL_CASH_QUERY_KEY,
  permission: PERMISSIONS.rentals.actions.charge.key,
  sessionHref: (id) => `/rentals/cash/${id}`,
  countLabel: 'Cobros',
  count: (session) => session.paymentCount,
  paymentHref: (payment) => `/rentals/agreements/${payment.detail.agreementId}`,
  paymentRef: (payment) => payment.detail.contractNumber ?? 0,
  renderDetail: (payment) => {
    const extra = rentalDetailText(payment);

    return (
      <span className="text-text-dim inline-flex min-w-0 flex-wrap items-center gap-1.5 break-words">
        {payment.detail.plate === null ? (
          <span>—</span>
        ) : (
          <PlateChip plate={payment.detail.plate} size="sm" />
        )}
        <span>{payment.detail.customerName}</span>
        {extra === null ? null : <span>· {extra}</span>}
      </span>
    );
  },
  showActors: false,
  openHelp: null,
  paymentsEmptyMessage: '',
  historyEmptyMessage: '',
};
