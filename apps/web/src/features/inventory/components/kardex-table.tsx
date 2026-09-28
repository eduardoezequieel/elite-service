'use client';

import type { InventoryMovement, Page } from '@elite/shared';

import { OriginLink } from '@/components/app-shell/origin-link';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { cn } from '@/lib/utils';
import { timeLabel } from '@/lib/civil-date';
import { formatMovementDate, pagedReference } from '../format';
import { toKardexRow, type KardexRow } from '../kardex';
import { MovementTypeStamp } from './movement-type-stamp';

function Dash() {
  return <span className="text-text-faint">—</span>;
}

/**
 * El kardex (065 RN-2): una fila por movimiento, append-only.
 *
 * Fecha **y** hora, tipo con su sello, cantidad con signo, saldo después, quién
 * lo registró, a quién se despachó, de qué lavado o venta sale y el motivo. Es
 * `DataTable`, así que bajo el corte de la lista cada fila se apila en tarjeta:
 * «a quién», «lavado o venta» y «motivo» bajan a sus propias líneas rotuladas
 * y ninguna columna se pierde.
 *
 * `withItem` agrega la columna del artículo, para el reporte plano de
 * movimientos; en la ficha de un artículo sobra.
 */
export function KardexTable({
  page,
  isLoading,
  errorMessage,
  withItem = false,
  emptyTitle,
  emptyMessage,
}: {
  page: Page<InventoryMovement> | undefined;
  isLoading: boolean;
  errorMessage: string | null;
  withItem?: boolean;
  emptyTitle: string;
  emptyMessage: string;
}) {
  const rows = (page?.items ?? []).map(toKardexRow);

  const itemColumn: DataTableColumn<KardexRow>[] = withItem
    ? [
        {
          key: 'item',
          header: 'Artículo',
          className: 'min-w-44 whitespace-normal',
          cell: (row) => (
            <OriginLink
              href={`/inventory/${row.itemId}`}
              className="hover:text-flame-text inline-flex min-h-(--touch-min) flex-col justify-center text-left"
            >
              <span className="text-text font-semibold">{row.itemName}</span>
              <span className="text-text-faint font-mono text-label">{row.itemCode}</span>
            </OriginLink>
          ),
        },
      ]
    : [];

  return (
    <DataTable
      rows={rows}
      rowKey={(row) => row.id}
      reference={(_row, index) => pagedReference(page, index)}
      isLoading={isLoading}
      errorMessage={errorMessage}
      emptyTitle={emptyTitle}
      emptyMessage={emptyMessage}
      columns={[
        {
          key: 'when',
          header: 'Fecha y hora',
          stack: 'title',
          className: 'whitespace-nowrap',
          cell: (row) => (
            <span className="flex flex-col leading-tight">
              <span className="text-text font-semibold">{formatMovementDate(row.createdAt)}</span>
              <span className="text-text-dim text-dense tabular-nums">
                {timeLabel(row.createdAt)}
              </span>
            </span>
          ),
        },
        {
          key: 'type',
          header: 'Tipo',
          stack: 'aside',
          className: 'whitespace-nowrap',
          cell: (row) => <MovementTypeStamp type={row.type} />,
        },
        ...itemColumn,
        {
          key: 'quantity',
          header: 'Cantidad',
          align: 'right',
          className: 'whitespace-nowrap',
          cell: (row) => (
            <span
              className={cn(
                'font-mono font-semibold [[data-density=bahia]_&]:text-body',
                row.isIncoming ? 'text-go-text' : 'text-text',
              )}
            >
              {row.quantity}
              <span className="text-text-faint ml-1 font-sans text-label font-normal">
                {row.unit}
              </span>
            </span>
          ),
        },
        {
          key: 'balance',
          header: 'Saldo',
          align: 'right',
          className: 'whitespace-nowrap',
          cell: (row) => <span className="text-text font-mono">{row.balance}</span>,
        },
        {
          key: 'who',
          header: 'Quién',
          className: 'whitespace-nowrap',
          cell: (row) =>
            row.who === null ? (
              <Dash />
            ) : (
              <span className="text-text">
                {row.who}
                {row.whoIsFloor ? (
                  <span className="text-text-faint text-dense"> · pista</span>
                ) : null}
              </span>
            ),
        },
        {
          key: 'to',
          header: 'A quién',
          className: 'whitespace-nowrap',
          cell: (row) =>
            row.toWhom === null ? <Dash /> : <span className="text-text">{row.toWhom}</span>,
        },
        {
          key: 'origin',
          header: 'Lavado o venta',
          className: 'whitespace-nowrap',
          cell: (row) =>
            row.origin === null ? (
              <Dash />
            ) : (
              <OriginLink
                href={row.origin.href}
                aria-label={row.origin.ariaLabel}
                className="text-flame-text inline-flex min-h-(--touch-min) items-center gap-1 font-mono font-semibold hover:underline"
              >
                <span className="text-text-dim font-sans font-normal">
                  {row.origin.kind === 'ticket' ? 'Lavado' : 'Venta'}
                </span>
                {row.origin.label}
              </OriginLink>
            ),
        },
        {
          key: 'reason',
          header: 'Motivo',
          headerClassName: 'w-full',
          className: 'min-w-48 whitespace-normal',
          cell: (row) =>
            row.reason === null ? <Dash /> : <span className="text-text-dim">{row.reason}</span>,
        },
      ]}
    />
  );
}
