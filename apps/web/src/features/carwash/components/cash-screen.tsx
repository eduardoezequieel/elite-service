'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { openCashSchema } from '@elite/shared';
import type { CashSession, OpenCashInput } from '@elite/shared';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { FieldBox } from '@/components/ui/field-box';
import { FilterBar, FiltersPopover, useFilterValues } from '@/components/ui/filters-popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatCard } from '@/components/ui/stat-card';
import { ALL_FILTER, uniqueOptions, withAllOption } from '@/lib/list-filters';
import { centsOf, formatMoney, formatSessionSpan, formatWhen, moneyParts } from '../cash-format';
import { matchesActor, sessionActors } from '../cash-history';
import {
  useCashSession,
  useCashSessions,
  useCurrentCashSession,
  useOpenCash,
} from '../hooks/use-cash';
import { CashDifferenceStamp } from './cash-difference-stamp';
import { CashMethodStats } from './cash-method-stats';
import { CashPaymentsTable } from './cash-payments-table';
import { CloseCashDialog } from './close-cash-dialog';
import { DetailSkeleton } from '@/components/ui/skeleton';

const DIFF_OPTIONS = withAllOption('Todas las diferencias', [
  { value: 'even', label: 'Cuadra' },
  { value: 'short', label: 'Falta' },
  { value: 'over', label: 'Sobra' },
]);

function differenceKey(difference: string | null): string {
  const cents = centsOf(difference ?? '0') ?? 0;
  if (cents === 0) return 'even';
  if (cents > 0) return 'over';

  return 'short';
}

export function CashScreen() {
  const current = useCurrentCashSession();
  const history = useCashSessions();
  const [closing, setClosing] = useState(false);
  const extra = useFilterValues(['who', 'difference'] as const);
  const closed = (history.data ?? []).filter((row) => row.status === 'CLOSED');
  const whoOptions = useMemo(
    () =>
      withAllOption(
        'Todos',
        uniqueOptions(
          closed.flatMap(sessionActors),
          (actor) => actor.id,
          (actor) => actor.fullName,
        ),
      ),
    [closed],
  );
  const rows = useMemo(() => {
    return closed.filter((row) => {
      if (extra.values.who !== ALL_FILTER && !matchesActor(row, extra.values.who)) return false;
      if (
        extra.values.difference !== ALL_FILTER &&
        differenceKey(row.differenceCash) !== extra.values.difference
      ) {
        return false;
      }

      return true;
    });
  }, [closed, extra.values.difference, extra.values.who]);

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
          session === null
            ? 'Sin turno abierto'
            : `Abrió ${session.openedBy.fullName} · ${formatWhen(session.openedAt)}`
        }
      >
        {session === null ? null : (
          <Button type="button" onClick={() => setClosing(true)}>
            Cerrar caja
          </Button>
        )}
      </ScreenHeader>

      {session === null ? <OpenCashForm /> : <OpenShiftStats session={session} />}

      {session === null ? null : <OpenShiftPayments sessionId={session.id} />}

      <div className="flex flex-col gap-3">
        <h2 className="text-title text-text">Historial</h2>
        <FilterBar>
          <FiltersPopover
            fields={[
              {
                id: 'who',
                label: 'Quién',
                value: extra.values.who,
                options: whoOptions,
                onChange: (value) => extra.set('who', value),
              },
              {
                id: 'difference',
                label: 'Diferencia',
                value: extra.values.difference,
                options: DIFF_OPTIONS,
                onChange: (value) => extra.set('difference', value),
              },
            ]}
            onReset={extra.reset}
          />
        </FilterBar>
        <DataTable
          rows={rows}
          rowKey={(row) => row.id}
          rowHref={(row) => `/carwash/cash/${row.id}`}
          isLoading={history.isPending}
          errorMessage={history.error?.message ?? null}
          emptyTitle={closed.length > 0 ? 'Ningún cierre coincide' : 'Todavía no hay cierres'}
          emptyMessage={
            closed.length > 0
              ? 'Nada coincide con esos filtros. Restablecelos o cambialos.'
              : 'Cuando cierres un turno va a aparecer acá.'
          }
          columns={[
            {
              key: 'span',
              header: 'Turno',
              stack: 'title',
              cell: (row) => (
                <span className="text-text">{formatSessionSpan(row.openedAt, row.closedAt)}</span>
              ),
            },
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
            {
              key: 'expected',
              header: 'Esperado',
              align: 'right',
              className: 'whitespace-nowrap',
              cell: (row) => (
                <span className="font-mono">{formatMoney(row.expectedCash ?? '0.00')}</span>
              ),
            },
            {
              key: 'counted',
              header: 'Contado',
              align: 'right',
              className: 'whitespace-nowrap',
              cell: (row) => (
                <span className="font-mono">{formatMoney(row.countedCash ?? '0.00')}</span>
              ),
            },
            {
              key: 'difference',
              header: 'Diferencia',
              stack: 'aside',
              cell: (row) => <CashDifferenceStamp difference={row.differenceCash} />,
            },
          ]}
        />
      </div>

      {session === null ? null : (
        <CloseCashDialog session={session} open={closing} onOpenChange={setClosing} />
      )}
    </div>
  );
}

type OpenCashFormValues = z.input<typeof openCashSchema>;

function OpenCashForm() {
  const openCash = useOpenCash();
  const { toast } = useToast();
  const form = useForm<OpenCashFormValues, unknown, OpenCashInput>({
    resolver: zodResolver(openCashSchema),
    mode: 'onChange',
    defaultValues: { openingFloat: '0.00' },
  });

  return (
    <Card className="gap-4 px-card">
      <p className="text-text-dim text-body">Sin caja abierta no se cobra.</p>
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

function OpenShiftPayments({ sessionId }: { sessionId: string }) {
  const detail = useCashSession(sessionId);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-title text-text">Cobros de este turno</h2>
      <CashPaymentsTable
        payments={detail.data?.payments ?? []}
        isLoading={detail.isPending}
        errorMessage={detail.error?.message ?? null}
      />
    </div>
  );
}

function OpenShiftStats({ session }: { session: CashSession }) {
  const float = moneyParts(session.openingFloat);
  const expected = moneyParts(session.expectedCash ?? '0.00');

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <h2 className="text-title text-text">Cobrado</h2>
        <CashMethodStats totals={session} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-title text-text">Turno</h2>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <StatCard label="Fondo" value={float.whole} unit={float.fraction} />
          <StatCard label="Esperado" value={expected.whole} unit={expected.fraction} />
          <StatCard
            label="Lavados cobrados"
            value={session.paymentCount}
            unit={session.paymentCount === 1 ? 'lavado' : 'lavados'}
          />
        </div>
      </section>
    </div>
  );
}
