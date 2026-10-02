'use client';

import {
  API_ERROR_CODES,
  PERMISSIONS,
  type EmployeeConsumptionDetail,
  type EmployeeConsumptionEntry,
} from '@elite/shared';
import { ChevronDown, CupSoda, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { DateRangeField } from '@/components/ui/date-field';
import { FilterBar } from '@/components/ui/filters-popover';
import { Stamp } from '@/components/ui/stamp';
import { StatCard } from '@/components/ui/stat-card';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { cn } from '@/lib/utils';
import { rangeSummary, timeLabel, type CivilRange } from '@/lib/civil-date';
import { LIST_PAGE_SIZE, replaceQuery } from '@/lib/list-params';
import { formatMoney, moneyParts } from '@/lib/money';
import { formatQuantity } from '@/lib/quantity';
import { consumptionRangeQuery, isReversed } from '../consumption';
import { formatMovementDate, pagedReference } from '../format';
import { useEmployeeConsumptionDetail } from '../hooks/use-inventory';
import { withPageQuery } from '../hooks/use-list-page';
import { Pager } from './pager';
import { DeliveryDialog } from './delivery-dialog';
import { ReverseConsumptionDialog } from './reverse-consumption-dialog';

/**
 * `/inventory/consumption/:employeeId?start=&end=` (070, 091): los consumos de
 * un trabajador en las fechas elegidas, más reciente arriba, anulados
 * incluidos y tachados. Las cifras de arriba no cuentan los anulados (RN-5).
 *
 * La fila dice qué, cuánto y cuánto vale; al tocarla se despliega debajo quién
 * lo anotó, el precio, la nota y, si se anuló, quién, cuándo y por qué (091).
 * «Anotar consumo» es la entrega con este trabajador fijo y solo productos.
 *
 * El regreso vuelve a «Consumos del personal» con el mismo rango: la fila del
 * reporte anota el origen al abrir esto (056).
 */
export function EmployeeConsumptionScreen({
  employeeId,
  initialRange,
  initialPage = 1,
}: {
  employeeId: string;
  initialRange: CivilRange;
  initialPage?: number;
}) {
  const { can } = usePermissions();
  const canMove = can(PERMISSIONS.inventory.actions.move.key);
  const [range, setRange] = useState<CivilRange>(initialRange);
  // Otro rango vuelve a la primera página (102).
  const narrowedBy = `${range.from}|${range.to}`;
  const [paging, setPaging] = useState({ narrowedBy, page: initialPage });
  const page = paging.narrowedBy === narrowedBy ? paging.page : 1;
  const detail = useEmployeeConsumptionDetail(employeeId, range, {
    page,
    pageSize: LIST_PAGE_SIZE,
  });
  // Se guarda el id, no la fila: la fila se relee de la consulta en cada
  // render y, si alguien la anula mientras tanto, el diálogo se cierra solo.
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());
  const [noting, setNoting] = useState(false);
  const data = detail.data;
  const summary = rangeSummary(range);

  useEffect(() => {
    replaceQuery(withPageQuery(consumptionRangeQuery(range), page));
  }, [range, page]);

  if (detail.error !== null) {
    return (
      <div>
        <ScreenHeader title="Consumo" subtitle={summary} />
        <p className="text-danger-text text-body" role="alert">
          {detail.error.code === API_ERROR_CODES.NOT_FOUND
            ? 'Ese empleado no existe.'
            : detail.error.message}
        </p>
      </div>
    );
  }

  const reversing = data?.entries.items.find(
    (entry) => entry.movementId === reversingId && !isReversed(entry),
  );

  const toggle = (entry: EmployeeConsumptionEntry) =>
    setOpenIds((previous) => {
      const next = new Set(previous);
      if (next.has(entry.movementId)) next.delete(entry.movementId);
      else next.add(entry.movementId);
      return next;
    });

  const columns: DataTableColumn<EmployeeConsumptionEntry>[] = [
    {
      key: 'when',
      header: 'Fecha y hora',
      stack: 'title',
      className: 'whitespace-nowrap',
      cell: (entry) => (
        <span className="inline-flex items-center gap-2">
          {/* La fila se abre al tocarla (091): el cheurón dice que hay más. */}
          <ChevronDown
            className={cn(
              'text-text-faint size-icon shrink-0 transition-transform duration-(--duration-state) ease-standard',
              openIds.has(entry.movementId) && 'rotate-180',
            )}
            strokeWidth={1.5}
            aria-hidden
          />
          <span className="flex flex-col leading-tight">
            <span className="text-text font-semibold">{formatMovementDate(entry.createdAt)}</span>
            <span className="text-text-dim text-dense tabular-nums">
              {timeLabel(entry.createdAt)}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: 'item',
      header: 'Artículo',
      headerClassName: 'w-full',
      className: 'whitespace-normal',
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
            <span>Consumo · {summary}</span>
            {data !== undefined && !data.employee.isActive ? (
              <Stamp tone="neutral" label="Inactivo" />
            ) : null}
          </span>
        }
      >
        {canMove && data !== undefined && data.employee.isActive ? (
          <Button type="button" variant="outline" onClick={() => setNoting(true)}>
            <CupSoda className="size-icon" strokeWidth={1.5} aria-hidden />
            Anotar consumo
          </Button>
        ) : null}
      </ScreenHeader>

      <FilterBar>
        <DateRangeField value={range} onChange={setRange} aria-label="Rango de consumos" />
      </FilterBar>

      {data === undefined ? null : <Totals detail={data} />}

      <DataTable
        rows={data?.entries.items ?? []}
        rowKey={(entry) => entry.movementId}
        reference={(_entry, index) => pagedReference(data?.entries, index)}
        onRowClick={toggle}
        renderExpanded={(entry) =>
          openIds.has(entry.movementId) ? <EntryDetail entry={entry} /> : null
        }
        isLoading={detail.isPending}
        errorMessage={null}
        emptyTitle="Sin consumos en estas fechas"
        emptyMessage="Lo que se le anote en esas fechas va a aparecer acá, con quién lo anotó."
        columns={columns}
      />

      <Pager
        page={data?.entries}
        noun={{ one: 'consumo', many: 'consumos' }}
        onPageChange={(next) => setPaging({ narrowedBy, page: next })}
      />

      {reversing !== undefined && data !== undefined ? (
        <ReverseConsumptionDialog
          entry={reversing}
          employeeName={data.employee.fullName}
          onClose={() => setReversingId(null)}
        />
      ) : null}

      {noting ? <DeliveryDialog employeeId={employeeId} onClose={() => setNoting(false)} /> : null}
    </div>
  );
}

/**
 * Lo que la fila abre al tocarla (091): quién lo anotó y cuándo, el precio
 * congelado, la nota y, si se anuló, quién, cuándo y por qué.
 */
function EntryDetail({ entry }: { entry: EmployeeConsumptionEntry }) {
  const note = entry.note?.trim() || null;
  const reversal = entry.reversal;

  return (
    <dl className="border-line-soft bg-surface grid grid-cols-1 gap-x-6 gap-y-2.5 rounded-control border px-4 py-3 sm:grid-cols-3">
      <div>
        <dt className="text-text-faint text-label">Anotó</dt>
        <dd className="text-text text-dense">
          {entry.createdBy?.fullName ?? 'Sin nombre'} · {formatMovementDate(entry.createdAt)},{' '}
          {timeLabel(entry.createdAt)}
        </dd>
      </div>
      <div>
        <dt className="text-text-faint text-label">Precio</dt>
        <dd className="text-text font-mono text-dense">
          {formatMoney(entry.unitPrice)} c/u, el de venta al anotar
        </dd>
      </div>
      <div>
        <dt className="text-text-faint text-label">Nota</dt>
        <dd className={cn('text-dense', note === null ? 'text-text-faint' : 'text-text')}>
          {note ?? 'Sin nota'}
        </dd>
      </div>
      {reversal === null ? null : (
        <div className="sm:col-span-3">
          <dt className="text-danger-text text-label">Anulado</dt>
          <dd className="text-text text-dense">
            {reversal.createdBy === null ? '' : `por ${reversal.createdBy.fullName} `}el{' '}
            {formatMovementDate(reversal.createdAt)}, {timeLabel(reversal.createdAt)} · «
            {reversal.reason}»
          </dd>
        </div>
      )}
    </dl>
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
