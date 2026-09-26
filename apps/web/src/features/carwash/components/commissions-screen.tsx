'use client';

import { useMemo } from 'react';
import type { CommissionEmployeeRow } from '@elite/shared';

import { DataTable } from '@/components/ui/data-table';
import { HelpTip } from '@/components/ui/help-tip';
import { Stamp } from '@/components/ui/stamp';
import type { CivilRange } from '@/lib/civil-date';
import { useCommissions } from '../hooks/use-tickets';
import { PERFORMANCE_HELP } from './performance/performance-parts';

/**
 * Reporte de comisiones a pagar (009). La pista no llega acá (009 RN-6).
 *
 * Desde la 067 vive en la pestaña Comisiones de Rendimiento: el rango lo manda
 * la pantalla y tocar a un empleado activo cambia el alcance a él. Es la única
 * vista de Rendimiento que incluye inactivos, porque se les puede deber la
 * comisión del rango (067 RN-8).
 */
export function CommissionsReport({
  range,
  onSelectEmployee,
}: {
  range: CivilRange;
  onSelectEmployee: (employeeId: string) => void;
}) {
  const params = useMemo(() => ({ from: range.from, to: range.to }), [range]);
  const report = useCommissions(params);
  const data = report.data;
  const employees = useMemo(() => data?.employees ?? [], [data?.employees]);
  const empty =
    data !== undefined && data.employees.length === 0 && data.unassigned.ticketCount === 0;
  const hasInactive = employees.some((row) => !row.isActive);

  return (
    <div className="flex flex-col gap-5">
      <DataTable
        rows={employees}
        rowKey={(row) => row.employeeId}
        onRowClick={(row) => {
          // Los inactivos no tienen el resto de Rendimiento: se quedan acá.
          if (row.isActive) onSelectEmployee(row.employeeId);
        }}
        isLoading={report.isPending}
        errorMessage={report.error?.message ?? null}
        emptyTitle={empty ? 'Sin lavados en este rango' : 'Nada por aquí todavía'}
        emptyMessage={
          empty
            ? 'Cuando se cobren lavados en estas fechas, acá aparece cómo le fue a cada empleado.'
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
            header: 'Lavados',
            align: 'right',
            cell: (row) => row.ticketCount,
          },
          {
            key: 'sales',
            header: 'Ventas atribuidas',
            align: 'right',
            help: PERFORMANCE_HELP.salesAttributed,
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

      {hasInactive ? (
        <p className="text-text-dim text-dense [[data-density=bahia]_&]:text-body">
          Los inactivos solo aparecen acá, porque se les debe la comisión del rango. En el resto de
          Rendimiento no cuentan.
        </p>
      ) : null}

      {data === undefined || empty ? null : (
        <div className="flex flex-col gap-2">
          <p className="text-text-faint inline-flex items-center gap-1.5 text-label">
            A pagar
            <HelpTip text={PERFORMANCE_HELP.commissions} />
          </p>
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
