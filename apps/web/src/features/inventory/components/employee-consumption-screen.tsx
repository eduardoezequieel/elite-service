'use client';

import {
  API_ERROR_CODES,
  PERMISSIONS,
  type EmployeeConsumptionDetail,
  type EmployeeConsumptionEntry,
} from '@elite/shared';
import { Undo2 } from 'lucide-react';
import { useState } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Stamp } from '@/components/ui/stamp';
import { StatCard } from '@/components/ui/stat-card';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { cn } from '@/lib/utils';
import { formatMoney, moneyParts } from '@/lib/money';
import { timeLabel } from '@/lib/civil-date';
import { formatQuantity } from '@/lib/quantity';
import { consumptionMonthTitle, isReversed, type ConsumptionMonth } from '../consumption';
import { formatMovementDate } from '../format';
import { useEmployeeConsumptionDetail } from '../hooks/use-inventory';
import { ReverseConsumptionDialog } from './reverse-consumption-dialog';

function Dash() {
  return <span className="text-text-faint">—</span>;
}

/**
 * `/inventory/consumption/:employeeId?month=` (spec 070): los consumos de un
 * trabajador en el mes, más reciente arriba, anulados incluidos y tachados.
 * Las cifras de arriba no cuentan los anulados (RN-5).
 *
 * El regreso vuelve a «Consumo de empleados» en el mismo mes: la fila del
 * reporte anota el origen al abrir esto (056).
 */
export function EmployeeConsumptionScreen({
  employeeId,
  month,
}: {
  employeeId: string;
  month: ConsumptionMonth;
}) {
  const { can } = usePermissions();
  const canMove = can(PERMISSIONS.inventory.actions.move.key);
  const detail = useEmployeeConsumptionDetail(employeeId, month);
  // Se guarda el id, no la fila: la fila se relee de la consulta en cada
  // render y, si alguien la anula mientras tanto, el diálogo se cierra solo.
  const [reversingId, setReversingId] = useState<string | null>(null);
  const data = detail.data;
  const monthTitle = consumptionMonthTitle(month);

  if (detail.error !== null) {
    return (
      <div>
        <ScreenHeader title="Consumo" subtitle={monthTitle} />
        <p className="text-danger-text text-body" role="alert">
          {detail.error.code === API_ERROR_CODES.NOT_FOUND
            ? 'Ese empleado no existe.'
            : detail.error.message}
        </p>
      </div>
    );
  }

  const reversing = data?.entries.find(
    (entry) => entry.movementId === reversingId && !isReversed(entry),
  );

  const columns: DataTableColumn<EmployeeConsumptionEntry>[] = [
    {
      key: 'when',
      header: 'Fecha y hora',
      stack: 'title',
      className: 'whitespace-nowrap',
      cell: (entry) => (
        <span className="flex flex-col leading-tight">
          <span className="text-text font-semibold">{formatMovementDate(entry.createdAt)}</span>
          <span className="text-text-dim text-dense tabular-nums">
            {timeLabel(entry.createdAt)}
          </span>
        </span>
      ),
    },
    {
      key: 'item',
      header: 'Artículo',
      className: 'min-w-44 whitespace-normal',
      cell: (entry) => (
        <span className="inline-flex flex-col text-left leading-tight">
          <span className={cn('text-text font-semibold', isReversed(entry) && 'is-ruled-out')}>
            {entry.item.name}
          </span>
          <span className="text-text-faint font-mono text-label">{entry.item.code}</span>
        </span>
      ),
    },
    {
      key: 'quantity',
      header: 'Cantidad',
      align: 'right',
      className: 'whitespace-nowrap',
      cell: (entry) => (
        <span
          className={cn(
            'text-text font-mono [[data-density=bahia]_&]:text-body',
            isReversed(entry) && 'is-ruled-out',
          )}
        >
          {formatQuantity(entry.quantity)}
          <span className="text-text-faint ml-1 font-sans text-label">{entry.item.unit}</span>
        </span>
      ),
    },
    {
      key: 'price',
      header: 'Precio',
      align: 'right',
      className: 'whitespace-nowrap',
      cell: (entry) => (
        <span className="text-text-dim font-mono">{formatMoney(entry.unitPrice)}</span>
      ),
    },
    {
      key: 'total',
      header: 'Valor',
      align: 'right',
      className: 'whitespace-nowrap',
      cell: (entry) => (
        <span
          className={cn(
            'text-text font-mono font-semibold [[data-density=bahia]_&]:text-body',
            isReversed(entry) && 'is-ruled-out',
          )}
        >
          {formatMoney(entry.total)}
        </span>
      ),
    },
    {
      key: 'createdBy',
      header: 'Anotó',
      className: 'whitespace-nowrap',
      cell: (entry) =>
        entry.createdBy === null ? (
          <Dash />
        ) : (
          <span className="text-text">{entry.createdBy.fullName}</span>
        ),
    },
    {
      key: 'note',
      header: 'Nota',
      headerClassName: 'w-full',
      className: 'min-w-48 whitespace-normal',
      cell: (entry) => <NoteCell entry={entry} />,
    },
    {
      key: 'status',
      header: 'Estado',
      stack: 'aside',
      className: 'whitespace-nowrap',
      cell: (entry) => (isReversed(entry) ? <Stamp tone="void" label="Anulado" /> : null),
    },
    ...(canMove
      ? [
          {
            key: 'actions',
            header: 'Acciones',
            stack: 'actions' as const,
            cell: (entry: EmployeeConsumptionEntry) =>
              isReversed(entry) ? null : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setReversingId(entry.movementId)}
                >
                  <Undo2 className="size-icon" strokeWidth={1.5} aria-hidden />
                  Anular
                </Button>
              ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader
        title={data?.employee.fullName ?? 'Consumo'}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <span>Consumo de {monthTitle.toLocaleLowerCase('es-SV')}</span>
            {data !== undefined && !data.employee.isActive ? (
              <Stamp tone="neutral" label="Inactivo" />
            ) : null}
          </span>
        }
      />

      {data === undefined ? null : <Totals detail={data} />}

      <DataTable
        rows={data?.entries ?? []}
        rowKey={(entry) => entry.movementId}
        isLoading={detail.isPending}
        errorMessage={null}
        emptyTitle={`Sin consumos en ${monthTitle.toLocaleLowerCase('es-SV')}`}
        emptyMessage="Lo que se le anote en este mes va a aparecer acá, con quién lo anotó."
        columns={columns}
      />

      {reversing !== undefined && data !== undefined ? (
        <ReverseConsumptionDialog
          entry={reversing}
          employeeName={data.employee.fullName}
          onClose={() => setReversingId(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * La nota y, si se anuló, quién, cuándo y por qué. Es la última columna del
 * escritorio; en la tarjeta apilada (bajo el corte de la lista) «Anotó» y
 * «Nota» bajan a sus propias líneas rotuladas.
 */
function NoteCell({ entry }: { entry: EmployeeConsumptionEntry }) {
  const note = entry.note?.trim() || null;
  const reversal = entry.reversal;

  if (note === null && reversal === null) return <Dash />;

  return (
    <span className="flex flex-col gap-0.5">
      {note === null ? null : <span className="text-text-dim">{note}</span>}
      {reversal === null ? null : (
        <span className="text-text-dim">
          <span className="text-danger-text font-semibold">Anulado</span>
          {reversal.createdBy === null ? null : ` por ${reversal.createdBy.fullName}`} el{' '}
          {formatMovementDate(reversal.createdAt)}, {timeLabel(reversal.createdAt)}:{' '}
          {reversal.reason}
        </span>
      )}
    </span>
  );
}

function Totals({ detail }: { detail: EmployeeConsumptionDetail }) {
  const total = moneyParts(detail.total);

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard label="Unidades" value={formatQuantity(detail.units)} unit="sin anulados" />
      <StatCard
        label="Valor a precio de venta"
        value={total.whole}
        unit={total.fraction}
        detail="No se cobra; es para llevar la cuenta."
      />
    </div>
  );
}
