'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { openCashSchema } from '@elite/shared';
import type { CashSession, OpenCashInput } from '@elite/shared';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatCard } from '@/components/ui/stat-card';
import { formatMoney, formatSessionSpan, moneyParts } from '../cash-format';
import { useCashSessions, useCurrentCashSession, useOpenCash } from '../hooks/use-cash';
import { CashDifferenceStamp } from './cash-difference-stamp';
import { CloseCashDialog } from './close-cash-dialog';

export function CashScreen() {
  const current = useCurrentCashSession();
  const history = useCashSessions();
  const [closing, setClosing] = useState(false);

  if (current.isPending) {
    return <p className="text-text-dim text-body">Cargando…</p>;
  }

  if (current.error !== null) {
    return (
      <p className="text-danger-text text-body" role="alert">
        {current.error.message}
      </p>
    );
  }

  const session = current.data ?? null;
  const closed = (history.data ?? []).filter((row) => row.status === 'CLOSED');

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader
        title="Caja"
        subtitle={session === null ? 'Sin turno abierto' : 'Turno abierto'}
      >
        {session === null ? null : (
          <Button type="button" onClick={() => setClosing(true)}>
            Cerrar caja
          </Button>
        )}
      </ScreenHeader>

      {session === null ? <OpenCashForm /> : <OpenShiftStats session={session} />}

      <div className="flex flex-col gap-3">
        <h2 className="text-title text-text">Historial</h2>
        <DataTable
          rows={closed}
          rowKey={(row) => row.id}
          rowHref={(row) => `/carwash/cash/${row.id}`}
          isLoading={history.isPending}
          errorMessage={history.error?.message ?? null}
          emptyTitle="Todavía no hay cierres"
          emptyMessage="Cuando cierres un turno va a aparecer acá."
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
              key: 'who',
              header: 'Quién',
              cell: (row) => (
                <span className="text-text-dim">
                  {row.closedBy?.fullName ?? row.openedBy.fullName}
                </span>
              ),
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
            {
              key: 'actions',
              header: 'Acciones',
              stack: 'actions',
              cell: (row) => (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/carwash/cash/${row.id}`}>Abrir</Link>
                </Button>
              ),
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

function OpenShiftStats({ session }: { session: CashSession }) {
  const float = moneyParts(session.openingFloat);
  const cash = moneyParts(session.cashTotal ?? '0.00');
  const expected = moneyParts(session.expectedCash ?? '0.00');
  const card = moneyParts(session.cardTotal ?? '0.00');
  const transfer = moneyParts(session.transferTotal ?? '0.00');

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard label="Fondo" value={float.whole} unit={float.fraction} />
      <StatCard label="Efectivo cobrado" value={cash.whole} unit={cash.fraction} />
      <StatCard label="Esperado" tone="go" value={expected.whole} unit={expected.fraction} />
      <StatCard label="Tarjeta" value={card.whole} unit={card.fraction} />
      <StatCard label="Transferencia" value={transfer.whole} unit={transfer.fraction} />
      <StatCard
        label="Tickets cobrados"
        value={session.paymentCount}
        unit={session.paymentCount === 1 ? 'ticket' : 'tickets'}
      />
    </div>
  );
}
