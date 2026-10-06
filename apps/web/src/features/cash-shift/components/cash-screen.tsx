'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { openCashSchema } from '@elite/shared';
import type { CashSession, OpenCashInput, Page } from '@elite/shared';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DetailSkeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { Pager } from '@/features/inventory/components/pager';
import { useListPage } from '@/features/inventory/hooks/use-list-page';
import { pageParam } from '@/lib/list-params';
import { formatMoney, moneyParts } from '@/lib/money';

import type { CashShiftAdapter, CashShiftPayment } from '../adapter';
import { formatSessionSpan, formatWhen } from '../cash-format';
import {
  useCashShiftList,
  useCashShiftSession,
  useCurrentCashShift,
  useOpenCashShift,
} from '../hooks/use-cash-shift';
import { useNamedPage } from '../hooks/use-named-page';
import { CashDifferenceStamp } from './cash-difference-stamp';
import { CashMethodStats, type CashMethodPayment } from './cash-method-stats';
import { CashPaymentsTable } from './cash-payments-table';
import { CloseCashDialog } from './close-cash-dialog';

/** La página de los cobros del turno abierto, al lado de la `page` del historial. */
const PAYMENTS_PAGE_PARAM = 'paymentsPage';

interface ShiftPayments<TPayment extends CashShiftPayment> {
  payments: Page<TPayment>;
  otherPayments: readonly CashMethodPayment[];
}

export function CashShiftScreen<TPayment extends CashShiftPayment>({
  adapter,
}: {
  adapter: CashShiftAdapter<TPayment>;
}) {
  const current = useCurrentCashShift(adapter);
  const searchParams = useSearchParams();
  const [page, setPage] = useListPage(pageParam(searchParams.get('page')), '');
  const [paymentsPage, setPaymentsPage] = useNamedPage(
    PAYMENTS_PAGE_PARAM,
    pageParam(searchParams.get(PAYMENTS_PAGE_PARAM)),
  );
  const history = useCashShiftList(adapter, page);
  const [closing, setClosing] = useState(false);
  const rows = (history.data?.items ?? []).filter((row) => row.status === 'CLOSED');
  const hasClosed = (history.data?.total ?? 0) > (current.data === null ? 0 : 1);

  if (current.isPending) {
    return <DetailSkeleton label="Cargando la caja" />;
  }

  if (current.error !== null) {
    return (
      <p className="text-danger-text text-body" role="alert">
        {current.error.message}
      </p>
    );
  }

  const session = current.data ?? null;

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader
        title="Caja"
        subtitle={
          adapter.showActors
            ? session === null
              ? 'Sin turno abierto'
              : `Abrió ${session.openedBy.fullName} · ${formatWhen(session.openedAt)}`
            : undefined
        }
      >
        {session === null ? null : (
          <Button type="button" onClick={() => setClosing(true)}>
            Cerrar caja
          </Button>
        )}
      </ScreenHeader>

      {session === null ? (
        <OpenCashForm adapter={adapter} />
      ) : (
        <OpenShiftStats adapter={adapter} session={session} page={paymentsPage} />
      )}

      {session === null ? null : (
        <OpenShiftPayments
          adapter={adapter}
          sessionId={session.id}
          page={paymentsPage}
          onPageChange={setPaymentsPage}
        />
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-title text-text">Historial</h2>
        <DataTable
          rows={rows}
          rowKey={(row) => row.id}
          rowHref={(row) => adapter.sessionHref(row.id)}
          isLoading={history.isPending}
          errorMessage={history.error?.message ?? null}
          emptyTitle={hasClosed ? 'No hay cierres en esta página' : 'Todavía no hay cierres'}
          emptyMessage={
            hasClosed
              ? 'Volvé a la página anterior para ver los cierres.'
              : adapter.historyEmptyMessage
          }
          columns={historyColumns(adapter.showActors)}
        />
        <Pager page={history.data} noun={{ one: 'turno', many: 'turnos' }} onPageChange={setPage} />
      </div>

      {session === null ? null : (
        <CloseCashDialog
          adapter={adapter}
          session={session}
          open={closing}
          onOpenChange={setClosing}
        />
      )}
    </div>
  );
}

function historyColumns(showActors: boolean): DataTableColumn<CashSession>[] {
  const span: DataTableColumn<CashSession> = {
    key: 'span',
    header: 'Turno',
    stack: 'title',
    cell: (row) => (
      <span className="text-text">{formatSessionSpan(row.openedAt, row.closedAt)}</span>
    ),
  };
  const actors: DataTableColumn<CashSession>[] = showActors
    ? [
        {
          key: 'openedBy',
          header: 'Abrió',
          cell: (row) => <span className="text-text-dim">{row.openedBy.fullName}</span>,
        },
        {
          key: 'closedBy',
          header: 'Cerró',
          cell: (row) => <span className="text-text-dim">{row.closedBy?.fullName ?? '—'}</span>,
        },
      ]
    : [];

  return [
    span,
    ...actors,
    {
      key: 'expected',
      header: 'Esperado',
      align: 'right',
      className: 'whitespace-nowrap',
      cell: (row) => <span className="font-mono">{formatMoney(row.expectedCash ?? '0.00')}</span>,
    },
    {
      key: 'counted',
      header: 'Contado',
      align: 'right',
      className: 'whitespace-nowrap',
      cell: (row) => <span className="font-mono">{formatMoney(row.countedCash ?? '0.00')}</span>,
    },
    {
      key: 'difference',
      header: 'Diferencia',
      stack: 'aside',
      cell: (row) => <CashDifferenceStamp difference={row.differenceCash} />,
    },
  ];
}

type OpenCashFormValues = z.input<typeof openCashSchema>;

function OpenCashForm<TPayment extends CashShiftPayment>({
  adapter,
}: {
  adapter: CashShiftAdapter<TPayment>;
}) {
  const openCash = useOpenCashShift(adapter);
  const { toast } = useToast();
  const form = useForm<OpenCashFormValues, unknown, OpenCashInput>({
    resolver: zodResolver(openCashSchema),
    mode: 'onChange',
    defaultValues: { openingFloat: '0.00' },
  });

  return (
    <Card className="gap-4 px-card">
      {adapter.openHelp === null ? null : (
        <p className="text-text-dim text-body">{adapter.openHelp}</p>
      )}
      <form
        noValidate
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={form.handleSubmit((values) => {
          openCash.mutate(values, {
            onSuccess: () => toast({ title: 'Caja abierta' }),
          });
        })}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <FieldBox className="min-h-(--touch-min)">
            <Label htmlFor="opening-float">Fondo</Label>
            <Input
              id="opening-float"
              inputMode="decimal"
              autoComplete="off"
              className="font-mono"
              aria-invalid={form.formState.errors.openingFloat ? true : undefined}
              {...form.register('openingFloat')}
            />
          </FieldBox>
          {form.formState.errors.openingFloat ? (
            <p className="text-danger-text text-label" role="alert">
              {form.formState.errors.openingFloat.message}
            </p>
          ) : null}
        </div>
        <Button type="submit" loading={openCash.isPending}>
          Abrir caja
        </Button>
      </form>
      {openCash.error ? (
        <p className="text-danger-text text-body" role="alert">
          {openCash.error.message}
        </p>
      ) : null}
    </Card>
  );
}

function OpenShiftPayments<TPayment extends CashShiftPayment>({
  adapter,
  sessionId,
  page,
  onPageChange,
}: {
  adapter: CashShiftAdapter<TPayment>;
  sessionId: string;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const detail = useCashShiftSession<ShiftPayments<TPayment>>(adapter, sessionId, page);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-title text-text">Cobros de este turno</h2>
      <CashPaymentsTable
        adapter={adapter}
        payments={detail.data?.payments}
        onPageChange={onPageChange}
        isLoading={detail.isPending}
        errorMessage={detail.error?.message ?? null}
      />
    </div>
  );
}

function OpenShiftStats<TPayment extends CashShiftPayment>({
  adapter,
  session,
  page,
}: {
  adapter: CashShiftAdapter<TPayment>;
  session: CashSession;
  page: number;
}) {
  const detail = useCashShiftSession<ShiftPayments<TPayment>>(adapter, session.id, page);
  const float = moneyParts(session.openingFloat);
  const expected = moneyParts(session.expectedCash ?? '0.00');
  const noun = adapter.countNoun;

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <h2 className="text-title text-text">Cobrado</h2>
        <CashMethodStats totals={session} payments={detail.data?.otherPayments} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-title text-text">Turno</h2>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <StatCard label="Fondo" value={float.whole} unit={float.fraction} />
          <StatCard label="Esperado" value={expected.whole} unit={expected.fraction} />
          <StatCard
            label={adapter.countLabel}
            value={session.paymentCount}
            unit={
              noun === undefined ? undefined : session.paymentCount === 1 ? noun.one : noun.many
            }
          />
        </div>
      </section>
    </div>
  );
}
