'use client';

import { useMemo, useState } from 'react';
import type { CommissionEmployeeRow } from '@elite/shared';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { DataTable } from '@/components/ui/data-table';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Stamp } from '@/components/ui/stamp';
import { Tabs } from '@/components/ui/tabs';
import { useCommissions } from '../hooks/use-tickets';

const RANGES = [
  { key: 'today', label: 'Hoy' },
  { key: '7d', label: '7 días' },
  { key: 'month', label: 'Este mes' },
] as const;

type RangeKey = (typeof RANGES)[number]['key'];

const TZ = 'America/El_Salvador';

function civilToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

function addDays(civil: string, days: number): string {
  const [year, month, day] = civil.split('-').map(Number);
  const utc = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days));

  return utc.toISOString().slice(0, 10);
}

function rangeOf(key: RangeKey): { from: string; to: string } {
  const to = civilToday();

  if (key === 'today') return { from: to, to };
  if (key === '7d') return { from: addDays(to, -6), to };

  return { from: `${to.slice(0, 7)}-01`, to };
}

/**
 * Reporte de comisiones a pagar. Hija de Lavados: no es pestaña del riel.
 * La pista no llega acá (009 RN-6).
 */
export function CommissionsScreen() {
  const [range, setRange] = useState<RangeKey>('today');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const params = useMemo(() => {
    if (from !== '' && to !== '') return { from, to };

    return rangeOf(range);
  }, [from, range, to]);
  const report = useCommissions(params);
  const data = report.data;
  const empty =
    data !== undefined && data.employees.length === 0 && data.unassigned.ticketCount === 0;

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader title="Comisiones" subtitle="Lo que hay que pagarle a cada lavador." />

      <Tabs
        aria-label="Rango de comisiones"
        value={range}
        onValueChange={(next) => {
          setRange(next);
          setFrom('');
          setTo('');
        }}
        items={RANGES.map((item) => ({ value: item.key, label: item.label }))}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <FieldBox>
          <Label htmlFor="commissions-from">Desde</Label>
          <Input
            id="commissions-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </FieldBox>
        <FieldBox>
          <Label htmlFor="commissions-to">Hasta</Label>
          <Input
            id="commissions-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </FieldBox>
      </div>

      <DataTable
        rows={data?.employees ?? []}
        rowKey={(row) => row.employeeId}
        isLoading={report.isPending}
        errorMessage={report.error?.message ?? null}
        emptyTitle={empty ? 'En este rango no hay lavados cobrados.' : 'Nada por aquí todavía'}
        emptyMessage={
          empty
            ? 'Cuando se cobre un lavado con lavador va a aparecer acá.'
            : 'Los lavados de oficina sin lavador no se pagan.'
        }
        columns={[
          {
            key: 'name',
            header: 'Lavador',
            stack: 'title',
            cell: (row) => <WasherName row={row} />,
          },
          {
            key: 'tickets',
            header: 'Tickets',
            align: 'right',
            cell: (row) => row.ticketCount,
          },
          {
            key: 'sales',
            header: 'Ventas atribuidas',
            align: 'right',
            cell: (row) => <span className="font-mono">${row.salesAttributed}</span>,
          },
          {
            key: 'commission',
            header: 'Comisión',
            align: 'right',
            cell: (row) => <span className="font-mono font-semibold">${row.commission}</span>,
          },
        ]}
      />

      {data === undefined ? null : (
        <div className="flex flex-col gap-2">
          <p className="text-text-faint text-label">A pagar</p>
          <p className="text-figure text-text tabular-nums">${data.totalPayable}</p>
          {data.unassigned.ticketCount > 0 ? (
            <p className="text-text-dim text-dense">
              {data.unassigned.ticketCount}{' '}
              {data.unassigned.ticketCount === 1 ? 'lavado' : 'lavados'} de oficina sin lavador,
              comisión no asignada ${data.unassigned.commission}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function WasherName({ row }: { row: CommissionEmployeeRow }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-text font-semibold">{row.fullName}</span>
      {row.isActive ? null : <Stamp tone="neutral" label="Inactivo" />}
    </span>
  );
}
