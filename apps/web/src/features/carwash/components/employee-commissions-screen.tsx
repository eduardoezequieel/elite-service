'use client';

import type { CommissionEmployeeDetail } from '@elite/shared';

import { DataTable } from '@/components/ui/data-table';
import { Pager } from '@/features/inventory/components/pager';
import { EmptyState } from '@/components/ui/empty-state';
import { PlateChip } from '@/components/ui/plate-chip';
import { Stamp } from '@/components/ui/stamp';
import { StatCard } from '@/components/ui/stat-card';
import type { CivilRange } from '@/lib/civil-date';
import { LIST_PAGE_SIZE } from '@/lib/list-params';
import { formatMoney, moneyParts } from '@/lib/money';
import { formatWhen } from '../cash-format';
import { useEmployeeCommissions } from '../hooks/use-tickets';
import { referenceOf } from '../reference';
import { PERFORMANCE_HELP, noWashesForEmployee } from './performance/performance-parts';

/**
 * Los lavados detrás de una fila del reporte de comisiones (061): el mismo
 * rango, las mismas entradas congeladas, una línea por lavado cobrado.
 *
 * Desde la 067 es la pestaña Comisiones de Rendimiento con un empleado elegido.
 * Cada lavado abre su ficha anotando el origen (056): volver cae en
 * Rendimiento con la misma pestaña, empleado y rango.
 */
export function EmployeeCommissionsDetail({
  employeeId,
  range,
  page,
  onPageChange,
}: {
  employeeId: string;
  range: CivilRange;
  /** La página de los lavados (102); los totales son del rango entero. */
  page: number;
  onPageChange: (page: number) => void;
}) {
  const detail = useEmployeeCommissions(employeeId, {
    from: range.from,
    to: range.to,
    page,
    pageSize: LIST_PAGE_SIZE,
  });
  const data = detail.data;

  if (data !== undefined && data.ticketCount === 0) {
    const empty = noWashesForEmployee(data.employee.fullName);

    return <EmptyState title={empty.title} description={empty.description} />;
  }

  return (
    <div className="flex flex-col gap-5">
      {data !== undefined && !data.employee.isActive ? (
        <p className="text-text-dim flex flex-wrap items-center gap-2 text-dense">
          <Stamp tone="neutral" label="Inactivo" />
          Ya no trabaja en el lavado; se le debe la comisión de este rango.
        </p>
      ) : null}

      {data === undefined ? null : <Totals detail={data} />}

      <DataTable
        rows={data?.washes.items ?? []}
        rowKey={(wash) => wash.workOrderId}
        reference={(wash) => referenceOf(wash.ticketNumber)}
        rowHref={(wash) => `/carwash/${wash.workOrderId}`}
        isLoading={detail.isPending}
        errorMessage={detail.error?.message ?? null}
        emptyTitle="En este rango no cobró lavados."
        emptyMessage="Cuando se cobre un lavado suyo va a aparecer acá."
        columns={[
          {
            key: 'plate',
            header: 'Placa',
            stack: 'title',
            cell: (wash) => <PlateChip plate={wash.plate} />,
          },
          {
            key: 'charged',
            header: 'Cobrado',
            cell: (wash) => <span className="text-text-dim">{formatWhen(wash.chargedAt)}</span>,
          },
          {
            key: 'total',
            header: 'Total del lavado',
            align: 'right',
            cell: (wash) => <span className="font-mono">{formatMoney(wash.ticketTotal)}</span>,
          },
          {
            key: 'commission',
            header: 'Comisión',
            align: 'right',
            cell: (wash) => (
              <span className="inline-flex items-baseline gap-2">
                {wash.washerCount > 1 ? (
                  <span className="text-text-faint text-dense">entre {wash.washerCount}</span>
                ) : null}
                <span className="font-mono font-semibold">{formatMoney(wash.commission)}</span>
              </span>
            ),
          },
        ]}
      />

      <Pager
        page={data?.washes}
        noun={{ one: 'lavado', many: 'lavados' }}
        onPageChange={onPageChange}
      />
    </div>
  );
}

function Totals({ detail }: { detail: CommissionEmployeeDetail }) {
  const sales = moneyParts(detail.salesAttributed);
  const commission = moneyParts(detail.commission);

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
      <StatCard
        label="Lavados"
        help={PERFORMANCE_HELP.washes}
        value={detail.ticketCount}
        unit={detail.ticketCount === 1 ? 'lavado' : 'lavados'}
      />
      <StatCard
        label="Ventas atribuidas"
        help={PERFORMANCE_HELP.salesAttributed}
        value={sales.whole}
        unit={sales.fraction}
      />
      <StatCard
        label="A pagar"
        help={PERFORMANCE_HELP.commission}
        value={commission.whole}
        unit={commission.fraction}
        tone="go"
      />
    </div>
  );
}
