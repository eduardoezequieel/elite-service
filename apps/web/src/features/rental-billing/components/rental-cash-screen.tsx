'use client';

import type { DepositHeldRow, ReceivableRow } from '@elite/shared';
import { useState } from 'react';

import { PlateChip } from '@/components/ui/plate-chip';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { CashShiftScreen } from '@/features/cash-shift/components/cash-screen';
import { CashShiftSessionScreen } from '@/features/cash-shift/components/cash-session-detail-screen';
import { Pager } from '@/features/inventory/components/pager';
import { formatMoney } from '@/lib/money';
import { useUrlPage } from '@/lib/use-url-page';

import { rentalCashAdapter } from '../cash-adapter';
import { useDepositsHeld, useReceivables } from '../hooks/use-rental-billing';
import { DepositReturnDialog } from './deposit-return-dialog';
import { PaymentDialog } from './payment-dialog';

export function RentalCashScreen({
  initialDepositsPage,
  initialReceivablesPage,
}: {
  initialDepositsPage: number;
  initialReceivablesPage: number;
}) {
  return (
    <div className="flex flex-col gap-5">
      <CashShiftScreen adapter={rentalCashAdapter} />
      <ReceivablesSection initialPage={initialReceivablesPage} />
      <DepositsSection initialPage={initialDepositsPage} />
    </div>
  );
}

export function RentalCashSessionScreen({ id }: { id: string }) {
  return <CashShiftSessionScreen id={id} adapter={rentalCashAdapter} />;
}

function ReceivablesSection({ initialPage }: { initialPage: number }) {
  const [page, setPage] = useUrlPage('receivablesPage', initialPage);
  const receivables = useReceivables(page);
  const [paying, setPaying] = useState<ReceivableRow | null>(null);

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle title="Quién me debe" total={receivables.data?.totalBalance} />
      <DataTable
        rows={receivables.data?.items ?? []}
        rowKey={(row) => row.agreementId}
        reference={(row) => row.contractNumber ?? 0}
        rowHref={(row) => `/rentals/agreements/${row.agreementId}`}
        isLoading={receivables.isPending}
        errorMessage={receivables.error?.message ?? null}
        emptyTitle="Nadie"
        emptyMessage=""
        columns={[
          {
            key: 'plate',
            header: 'Placa',
            cell: (row) => <PlateCell plate={row.plate} />,
          },
          {
            key: 'customer',
            header: 'Cliente',
            stack: 'title',
            cell: (row) => <span className="text-text">{row.customer}</span>,
          },
          {
            key: 'amount',
            header: 'Monto',
            align: 'right',
            cell: (row) => <span className="font-mono">{formatMoney(row.balance)}</span>,
          },
          {
            key: 'charge',
            header: '',
            stack: 'actions',
            cell: (row) => (
              <Button type="button" onClick={() => setPaying(row)}>
                Cobrar
              </Button>
            ),
          },
        ]}
      />
      <Pager
        page={receivables.data}
        noun={{ one: 'cuenta', many: 'cuentas' }}
        onPageChange={setPage}
      />
      {paying === null ? null : (
        <PaymentDialog
          agreementId={paying.agreementId}
          balance={paying.balance}
          onClose={() => setPaying(null)}
        />
      )}
    </section>
  );
}

function DepositsSection({ initialPage }: { initialPage: number }) {
  const [page, setPage] = useUrlPage('depositsPage', initialPage);
  const deposits = useDepositsHeld(page);
  const [returning, setReturning] = useState<DepositHeldRow | null>(null);

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle title="Garantías" total={deposits.data?.totalAmount} />
      <DataTable
        rows={deposits.data?.items ?? []}
        rowKey={(row) => row.agreementId}
        reference={(row) => row.contractNumber ?? 0}
        rowHref={(row) => `/rentals/agreements/${row.agreementId}`}
        isLoading={deposits.isPending}
        errorMessage={deposits.error?.message ?? null}
        emptyTitle="Ninguna"
        emptyMessage=""
        columns={[
          {
            key: 'plate',
            header: 'Placa',
            cell: (row) => <PlateCell plate={row.plate} />,
          },
          {
            key: 'customer',
            header: 'Cliente',
            stack: 'title',
            cell: (row) => <span className="text-text">{row.customer}</span>,
          },
          {
            key: 'amount',
            header: 'Monto',
            align: 'right',
            cell: (row) => <span className="font-mono">{formatMoney(row.amount)}</span>,
          },
          {
            key: 'return',
            header: '',
            stack: 'actions',
            cell: (row) => (
              <Button type="button" onClick={() => setReturning(row)}>
                Devolver
              </Button>
            ),
          },
        ]}
      />
      <Pager
        page={deposits.data}
        noun={{ one: 'garantía', many: 'garantías' }}
        onPageChange={setPage}
      />
      {returning === null ? null : (
        <DepositReturnDialog
          agreementId={returning.agreementId}
          deposit={returning.amount}
          onClose={() => setReturning(null)}
        />
      )}
    </section>
  );
}

function SectionTitle({ title, total }: { title: string; total: string | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-title text-text">{title}</h2>
      {total === undefined ? null : (
        <span className="font-mono tabular-nums">{formatMoney(total)}</span>
      )}
    </div>
  );
}

function PlateCell({ plate }: { plate: string | null }) {
  if (plate === null) return <span className="text-text-dim">—</span>;

  return <PlateChip plate={plate} size="sm" />;
}
