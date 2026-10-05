'use client';

import type { InventoryMovement, Page } from '@elite/shared';

import { OriginLink } from '@/components/app-shell/origin-link';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { cn } from '@/lib/utils';
import { timeLabel } from '@/lib/civil-date';
import { formatMovementDate, pagedReference } from '../format';
import { toKardexRow, type KardexDetail, type KardexRow, type MovementOrigin } from '../kardex';
import { MovementTypeStamp } from './movement-type-stamp';

/**
 * El kardex (065 RN-2): una fila por movimiento, append-only.
 *
 * Fecha **y** hora, tipo con su sello, cantidad con signo, saldo después y el
 * «Detalle» (091): una frase con lo que fue —la factura, el lavado, quién
 * recibió o tomó, el motivo— y debajo quién lo registró. Antes eran cuatro
 * columnas —quién, a quién, lavado o venta, motivo— casi siempre con guiones.
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
          key: 'detail',
          header: 'Detalle',
          headerClassName: 'w-full',
          className: 'min-w-56 whitespace-normal',
          cell: (row) => <DetailCell detail={row.detail} />,
        },
      ]}
    />
  );
}

/** La palabra delante del folio: «Lavado #14», «Venta V-0003», «Cuenta C-0012» (105). */
const ORIGIN_LABELS: Record<MovementOrigin['kind'], string> = {
  ticket: 'Lavado',
  sale: 'Venta',
  tab: 'Cuenta',
};

/** La frase del «Detalle»: lo que se lee primero y, debajo, tenue, quién lo registró. */
function DetailCell({ detail }: { detail: KardexDetail }) {
  const { lead, notes } = detail;

  return (
    <span className="flex flex-col gap-0.5 text-left">
      <span className="text-text">
        {lead.kind === 'text' ? (
          <span className={lead.muted ? 'text-text-faint' : undefined}>{lead.text}</span>
        ) : lead.kind === 'person' ? (
          <>
            <span className="text-text-dim">{lead.prefix} </span>
            <span className="font-semibold">{lead.name}</span>
            {lead.suffix === undefined ? null : (
              <span className="font-mono tabular-nums"> · {lead.suffix}</span>
            )}
          </>
        ) : (
          <>
            {lead.prefix === undefined ? null : (
              <span className="text-text-dim">{lead.prefix} </span>
            )}
            <OriginLink
              href={lead.origin.href}
              aria-label={lead.origin.ariaLabel}
              className="text-flame-text inline-flex min-h-(--touch-min) items-center gap-1 font-mono font-semibold hover:underline"
            >
              <span className="text-text-dim font-sans font-normal">
                {ORIGIN_LABELS[lead.origin.kind]}
              </span>
              {lead.origin.label}
            </OriginLink>
            {lead.holder === undefined ? null : (
              <span className="text-text-dim">
                {' · '}
                <span className="text-text font-semibold">{lead.holder}</span>
              </span>
            )}
          </>
        )}
      </span>
      {notes.length === 0 ? null : (
        <span className="text-text-faint text-dense">{notes.join(' · ')}</span>
      )}
    </span>
  );
}
