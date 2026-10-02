'use client';

import type { CashSessionPayment, Page } from '@elite/shared';

import { DataTable } from '@/components/ui/data-table';
import { Pager } from '@/features/inventory/components/pager';
import { formatMoney } from '@/lib/money';
import { formatWhen, paymentDetailText } from '../cash-format';
import { referenceOf } from '../reference';
import { PaymentMethodStamp } from './payment-method-stamp';

/** Una página de los cobros del turno (102), con su paginador debajo. */
export function CashPaymentsTable({
  payments,
  onPageChange,
  isLoading = false,
  errorMessage = null,
}: {
  payments: Page<CashSessionPayment> | undefined;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  errorMessage?: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <DataTable
        rows={payments?.items ?? []}
        rowKey={(payment) => payment.id}
        // Un pago es de un lavado o de una venta suelta (065).
        reference={(payment) => referenceOf(payment.ticketNumber ?? payment.saleNumber ?? '')}
        rowHref={(payment) =>
          payment.workOrderId !== null
            ? `/carwash/${payment.workOrderId}`
            : `/sales/${payment.counterSaleId ?? ''}`
        }
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
            // La cuenta y la referencia de una transferencia, o qué fue un pago
            // «Otro» (069). Lo demás no tiene detalle.
            key: 'detail',
            header: 'Detalle',
            cell: (payment) => (
              <span className="text-text-dim break-words">{paymentDetailText(payment) ?? '—'}</span>
            ),
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
