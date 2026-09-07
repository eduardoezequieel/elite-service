'use client';

import type { CashSessionPayment } from '@elite/shared';

import { DataTable } from '@/components/ui/data-table';
import { formatMoney, formatWhen } from '../cash-format';
import { referenceOf } from '../reference';
import { PaymentMethodStamp } from './payment-method-stamp';

export function CashPaymentsTable({
  payments,
  isLoading = false,
  errorMessage = null,
}: {
  payments: CashSessionPayment[];
  isLoading?: boolean;
  errorMessage?: string | null;
}) {
  return (
    <DataTable
      rows={payments}
      rowKey={(payment) => payment.id}
      reference={(payment) => referenceOf(payment.ticketNumber)}
      rowHref={(payment) => `/carwash/${payment.workOrderId}`}
      isLoading={isLoading}
      errorMessage={errorMessage}
      emptyTitle="Todavía no hay cobros"
      emptyMessage="Cuando cobres un lavado va a aparecer acá."
      columns={[
        {
          key: 'method',
          header: 'Método',
          stack: 'aside',
          cell: (payment) => <PaymentMethodStamp method={payment.method} />,
        },
        {
          key: 'amount',
          header: 'Monto',
          stack: 'title',
          align: 'right',
          cell: (payment) => <span className="font-mono">{formatMoney(payment.amount)}</span>,
        },
        {
          key: 'when',
          header: 'Hora',
          cell: (payment) => <span className="text-text-dim">{formatWhen(payment.paidAt)}</span>,
        },
      ]}
    />
  );
}
