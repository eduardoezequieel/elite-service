'use client';

import { useMemo, useState } from 'react';
import type { CommissionEmployeeRow } from '@elite/shared';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { DataTable } from '@/components/ui/data-table';
import { DateRangeField } from '@/components/ui/date-field';
import { FilterBar, FiltersPopover, useFilterValues } from '@/components/ui/filters-popover';
import { Stamp } from '@/components/ui/stamp';
import { presetRange, type CivilRange } from '@/lib/civil-date';
import { activityOptions, matchesActivity } from '@/lib/list-filters';
import { useCommissions } from '../hooks/use-tickets';

/**
 * Reporte de comisiones a pagar. Hija de Lavados: no es pestaña del riel.
 * La pista no llega acá (009 RN-6).
 */
export function CommissionsScreen() {
  const [range, setRange] = useState<CivilRange>(() => presetRange('today'));
  const params = useMemo(() => ({ from: range.from, to: range.to }), [range]);
  const report = useCommissions(params);
  const extra = useFilterValues(['active'] as const);
  const data = report.data;
  const employees = useMemo(
    () =>
      (data?.employees ?? []).filter((row) => matchesActivity(row.isActive, extra.values.active)),
    [data?.employees, extra.values.active],
  );
  const empty =
    data !== undefined && data.employees.length === 0 && data.unassigned.ticketCount === 0;

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader title="Comisiones" subtitle="Lo que hay que pagarle a cada empleado." />

      <FilterBar>
        <DateRangeField
          value={range}
          onChange={setRange}
          aria-label="Rango de comisiones"
        />
        <FiltersPopover
          fields={[
            {
              id: 'active',
              label: 'Estado',
              value: extra.values.active,
              options: activityOptions('Todos los empleados', 'Activos', 'Inactivos'),
              onChange: (value) => extra.set('active', value),
            },
          ]}
          onReset={extra.reset}
        />
      </FilterBar>

      <DataTable
        rows={employees}
        rowKey={(row) => row.employeeId}
        isLoading={report.isPending}
        errorMessage={report.error?.message ?? null}
        emptyTitle={empty ? 'En este rango no hay lavados cobrados.' : 'Nada por aquí todavía'}
        emptyMessage={
          empty
            ? 'Cuando se cobre un lavado con empleado va a aparecer acá.'
            : 'Los lavados de oficina sin empleado no se pagan.'
        }
        columns={[
          {
            key: 'name',
            header: 'Empleado',
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
              {data.unassigned.ticketCount === 1 ? 'lavado' : 'lavados'} de oficina sin empleado,
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
