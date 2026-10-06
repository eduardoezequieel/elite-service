'use client';

import type { Page } from '@elite/shared';

import { DataTable } from '@/components/ui/data-table';
import { Pager } from '@/features/inventory/components/pager';
import { formatMoney } from '@/lib/money';

import type { CashShiftAdapter, CashShiftPayment } from '../adapter';
import { formatWhen } from '../cash-format';
import { PaymentMethodStamp } from './payment-method-stamp';

/** Una página de los cobros del turno (102), con su paginador debajo. */
export function CashPaymentsTable<TPayment extends CashShiftPayment>({
  adapter,
  payments,
  onPageChange,
  isLoading = false,
  errorMessage = null,
}: {
  adapter: CashShiftAdapter<TPayment>;
  payments: Page<TPayment> | undefined;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  errorMessage?: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <DataTable
        rows={payments?.items ?? []}
        rowKey={(payment) => payment.id}
        reference={(payment) => adapter.paymentRef(payment)}
        rowHref={(payment) => adapter.paymentHref(payment)}
        isLoading={isLoading}
        errorMessage={errorMessage}
        emptyTitle="Todavía no hay cobros"
        emptyMessage={adapter.paymentsEmptyMessage}
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
            key: 'detail',
            header: 'Detalle',
            cell: (payment) => adapter.renderDetail(payment),
          },
          {
            key: 'when',
            header: 'Hora',
            cell: (payment) => <span className="text-text-dim">{formatWhen(payment.paidAt)}</span>,
          },
        ]}
      />
      <Pager page={payments} noun={{ one: 'cobro', many: 'cobros' }} onPageChange={onPageChange} />
    </div>
  );
}
