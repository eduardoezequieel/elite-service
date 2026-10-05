'use client';

import { MAX_PAGE_SIZE, PERMISSIONS } from '@elite/shared';
import type { SalesFeedEntry } from '@elite/shared';
import { Ban, CircleDollarSign, Plus, Receipt, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { DateField } from '@/components/ui/date-field';
import { FilterChip } from '@/components/ui/filter-chip';
import { FilterBar } from '@/components/ui/filters-popover';
import { Stamp } from '@/components/ui/stamp';
import { StatCard } from '@/components/ui/stat-card';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { timeLabel, todayCivil } from '@/lib/civil-date';
import { replaceQuery } from '@/lib/list-params';
import { centsParts } from '@/lib/money';
import { useSalesFeed } from '../hooks/use-sales';
import { salesDateFrom, salesListQuery } from '../list-params';
import {
  feedEntryHref,
  feedEntryKey,
  feedFilterCount,
  filterFeed,
  productsSummary,
  summarizeFeed,
  type FeedFilter,
} from '../sale-format';
import { AccountTicketLinks } from './account-ticket-links';
import { SalePaymentsIcons, SaleStatusStamp } from './sale-stamps';

const FILTERS: readonly { value: FeedFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'PAID', label: 'Pagadas' },
  { value: 'VOID', label: 'Anuladas' },
];

const EMPTY_FEED: SalesFeedEntry[] = [];

/**
 * `/sales`, «Ventas del día» (065, 106): las ventas sueltas y los abonos a
 * cuentas abiertas de un día, lo más nuevo primero (`GET /sales/feed`).
 *
 * Arriba lo que el día suma; debajo el día, los chips y la lista. Un abono es
 * una fila más, con el número de su cuenta, «Cuenta de {titular}» y el sello
 * «De cuenta»; tocarla abre la cuenta. Los chips filtran lo ya traído: un día
 * de mostrador no llega a las cien filas, y si llegara, la paginación lo cubre.
 */
export function SalesScreen() {
  const { can } = usePermissions();
  const canSell = can(PERMISSIONS.carwash.actions.charge.key);
  const searchParams = useSearchParams();
  // La fecha va en la URL para que volver de la ficha (spec 056) la conserve.
  const [date, setDate] = useState<string>(
    () => salesDateFrom(searchParams.get('date')) ?? todayCivil(),
  );
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    replaceQuery(salesListQuery(date));
  }, [date]);

  const feed = useSalesFeed({ date, page, pageSize: MAX_PAGE_SIZE });
  const rows = feed.data?.items ?? EMPTY_FEED;
  const summary = useMemo(() => summarizeFeed(rows), [rows]);
  const visible = useMemo(() => filterFeed(rows, filter), [filter, rows]);
  const pages =
    feed.data === undefined ? 1 : Math.max(1, Math.ceil(feed.data.total / feed.data.pageSize));
  const counting = feed.isPending;
  const sold = centsParts(summary.soldCents);
  const cash = centsParts(summary.cashCents);
  const isToday = date === todayCivil();

  const newSale = canSell ? (
    <Button asChild>
      <Link href="/sales/new">
        <Plus aria-hidden strokeWidth={1.5} />
        Nueva venta
      </Link>
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={isToday ? 'Vendido hoy' : 'Vendido'}
          value={counting ? '—' : sold.whole}
          unit={counting ? undefined : sold.fraction}
          icon={<CircleDollarSign className="size-5" strokeWidth={1.75} aria-hidden />}
        />
        <StatCard
          label="Ventas pagadas"
          tone="go"
          value={counting ? '—' : summary.paidCount}
          icon={<Receipt className="size-5" strokeWidth={1.75} aria-hidden />}
        />
        <StatCard
          label="En efectivo"
          value={counting ? '—' : cash.whole}
          unit={counting ? undefined : cash.fraction}
          icon={<Wallet className="size-5" strokeWidth={1.75} aria-hidden />}
        />
        <StatCard
          label="Anuladas"
          value={counting ? '—' : summary.voidCount}
          icon={<Ban className="size-5" strokeWidth={1.75} aria-hidden />}
        />
      </div>

      <FilterBar className="items-center">
        <DateField
          value={date}
          onChange={(next) => {
            setDate(next);
            setPage(1);
          }}
          aria-label="Fecha de las ventas"
        />
        <div role="group" aria-label="Qué ventas" className="flex flex-wrap gap-2">
          {FILTERS.map((option) => (
            <FilterChip
              key={option.value}
              pressed={filter === option.value}
              count={counting ? undefined : feedFilterCount(summary, option.value)}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </FilterChip>
          ))}
        </div>
      </FilterBar>

      <DataTable
        rows={visible}
        rowKey={feedEntryKey}
        rowHref={feedEntryHref}
        isLoading={feed.isPending}
        errorMessage={feed.error?.message ?? null}
        emptyTitle={
          filter === 'VOID' ? 'Ninguna anulada' : isToday ? 'Sin ventas hoy' : 'Sin ventas ese día'
        }
        emptyMessage=""
        emptyAction={filter === 'all' && isToday ? newSale : undefined}
        columns={[
          {
            key: 'number',
            header: 'Número',
            stack: 'title',
            className: 'whitespace-nowrap',
            cell: (entry) =>
              entry.kind === 'SALE' ? (
                <span className="flex flex-col">
                  <span className="text-text font-mono font-semibold">{entry.sale.number}</span>
                  <AccountTicketLinks tickets={entry.sale.accountTickets} className="text-dense" />
                </span>
              ) : (
                <span className="text-text font-mono font-semibold">
                  {entry.tabPayment.tab.number}
                </span>
              ),
          },
          {
            key: 'time',
            header: 'Hora',
            className: 'whitespace-nowrap',
            cell: (entry) => (
              <span className="text-text-dim font-mono tabular-nums">{timeLabel(entry.at)}</span>
            ),
          },
          {
            key: 'customer',
            header: 'Cliente',
            // Productos se lleva el sobrante (`w-full`); sin piso, el nombre se partía en tres líneas.
            headerClassName: 'min-w-50',
            cell: (entry) =>
              entry.kind === 'TAB_PAYMENT' ? (
                <span className="text-text">Cuenta de {entry.tabPayment.tab.holder.fullName}</span>
              ) : entry.sale.customerName === null ? (
                <span className="text-text-faint">Sin nombre</span>
              ) : (
                <span className="text-text">{entry.sale.customerName}</span>
              ),
          },
          {
            key: 'products',
            header: 'Productos',
            headerClassName: 'w-full',
            className: 'whitespace-normal',
            cell: (entry) =>
              entry.kind === 'SALE' ? (
                <span className="text-text-dim">{productsSummary(entry.sale.items)}</span>
              ) : (
                <span className="text-text-faint">Abono</span>
              ),
          },
          {
            key: 'total',
            header: 'Total',
            align: 'right',
            cell: (entry) =>
              entry.kind === 'TAB_PAYMENT' ? (
                <span className="text-text font-mono font-semibold tabular-nums">
                  ${entry.tabPayment.amount}
                </span>
              ) : (
                <span
                  className={
                    entry.sale.status === 'VOID'
                      ? 'text-text-dim is-ruled-out font-mono tabular-nums'
                      : 'text-text font-mono font-semibold tabular-nums'
                  }
                >
                  ${entry.sale.total}
                </span>
              ),
          },
          {
            key: 'methods',
            header: 'Método',
            cell: (entry) =>
              entry.kind === 'TAB_PAYMENT' ? (
                <SalePaymentsIcons payments={[entry.tabPayment]} />
              ) : entry.sale.payments.length === 0 ? (
                <span className="text-text-faint">Sin pagos</span>
              ) : (
                <SalePaymentsIcons payments={entry.sale.payments} />
              ),
          },
          {
            key: 'status',
            header: 'Estado',
            stack: 'aside',
            cell: (entry) =>
              entry.kind === 'TAB_PAYMENT' ? (
                <Stamp tone="consume" label="De cuenta" />
              ) : (
                <SaleStatusStamp status={entry.sale.status} />
              ),
          },
        ]}
      />

      {pages > 1 ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-text-dim text-dense mr-auto">
            Página {page} de {pages}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={page <= 1 || feed.isFetching}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={page >= pages || feed.isFetching}
            onClick={() => setPage((current) => Math.min(pages, current + 1))}
          >
            Siguiente
          </Button>
        </div>
      ) : null}
    </div>
  );
}
