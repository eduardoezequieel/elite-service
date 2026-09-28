'use client';

import { MAX_PAGE_SIZE, PERMISSIONS } from '@elite/shared';
import type { CounterSale } from '@elite/shared';
import { Ban, CircleDollarSign, List, Plus, Receipt, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { DateField } from '@/components/ui/date-field';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs } from '@/components/ui/tabs';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { formatCivil, isCivil, timeLabel, todayCivil } from '@/lib/civil-date';
import { centsParts } from '@/lib/money';
import { useSales } from '../hooks/use-sales';
import { productsSummary, summarizeSales } from '../sale-format';
import { AccountTicketLinks } from './account-ticket-links';
import { SalePaymentsIcons, SaleStatusStamp } from './sale-stamps';

const FILTERS = [
  { value: 'all', label: 'Todas', icon: List },
  { value: 'PAID', label: 'Pagadas', icon: Receipt },
  { value: 'VOID', label: 'Anuladas', icon: Ban },
] as const;

type Filter = (typeof FILTERS)[number]['value'];

const EMPTY_SALES: CounterSale[] = [];

/**
 * `/sales`: las ventas sueltas de un día (065).
 *
 * Arriba lo que el día suma —vendido, cuántas, cuánto en efectivo y cuántas se
 * anularon—; debajo la lista, con la fila entera abriendo la ficha. Las
 * pestañas filtran lo ya traído: un día de mostrador no llega a las cien
 * ventas sueltas, y si llegara, la paginación de abajo lo cubre.
 */
export function SalesScreen() {
  const { can } = usePermissions();
  const canSell = can(PERMISSIONS.carwash.actions.charge.key);
  const [date, setDate] = useState<string>(todayCivil);
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);

  // La fecha va en la URL para que volver de la ficha (spec 056) la conserve.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('date');

    if (fromUrl !== null && isCivil(fromUrl)) setDate(fromUrl);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    params.set('date', date);
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  }, [date]);

  const sales = useSales({ date, page, pageSize: MAX_PAGE_SIZE });
  const rows = sales.data?.items ?? EMPTY_SALES;
  const summary = useMemo(() => summarizeSales(rows), [rows]);
  const visible = useMemo(
    () => (filter === 'all' ? rows : rows.filter((sale) => sale.status === filter)),
    [filter, rows],
  );
  const pages =
    sales.data === undefined ? 1 : Math.max(1, Math.ceil(sales.data.total / sales.data.pageSize));
  const counting = sales.isPending;
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
    <div className="flex flex-col gap-5">
      <ScreenHeader
        title="Ventas"
        subtitle={`Productos vendidos sin lavado · ${isToday ? 'hoy' : formatCivil(date)}. Entran al turno de caja y no pagan comisión.`}
      >
        <DateField
          value={date}
          onChange={(next) => {
            setDate(next);
            setPage(1);
          }}
          aria-label="Fecha de las ventas"
        />
        {newSale}
      </ScreenHeader>

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

      <Tabs
        aria-label="Filtro de ventas"
        value={filter}
        onValueChange={setFilter}
        items={FILTERS.map((option) => ({
          value: option.value,
          label: option.label,
          icon: option.icon,
          count: counting
            ? undefined
            : option.value === 'all'
              ? rows.length
              : option.value === 'PAID'
                ? summary.paidCount
                : summary.voidCount,
        }))}
      />

      <div id={`tabpanel-${filter}`} role="tabpanel" aria-labelledby={`tab-${filter}`}>
        <DataTable
          rows={visible}
          rowKey={(sale) => sale.id}
          rowHref={(sale) => `/sales/${sale.id}`}
          isLoading={sales.isPending}
          errorMessage={sales.error?.message ?? null}
          emptyTitle={
            filter === 'VOID'
              ? 'Ninguna anulada'
              : isToday
                ? 'Sin ventas hoy'
                : 'Sin ventas ese día'
          }
          emptyMessage={
            filter === 'VOID'
              ? 'Las ventas anuladas quedan acá, con quién y por qué.'
              : 'Cuando cobres una venta suelta va a aparecer acá.'
          }
          emptyAction={filter === 'all' && isToday ? newSale : undefined}
          columns={[
            {
              key: 'number',
              header: 'Número',
              stack: 'title',
              className: 'whitespace-nowrap',
              cell: (sale) => (
                <span className="flex flex-col">
                  <span className="text-text font-mono font-semibold">{sale.number}</span>
                  <AccountTicketLinks tickets={sale.accountTickets} className="text-dense" />
                </span>
              ),
            },
            {
              key: 'time',
              header: 'Hora',
              className: 'whitespace-nowrap',
              cell: (sale) => (
                <span className="text-text-dim font-mono tabular-nums">
                  {timeLabel(sale.createdAt)}
                </span>
              ),
            },
            {
              key: 'customer',
              header: 'Cliente',
              // Productos se lleva el sobrante (`w-full`); sin piso, el nombre se partía en tres líneas.
              headerClassName: 'min-w-[200px]',
              cell: (sale) =>
                sale.customerName === null ? (
                  <span className="text-text-faint">Sin nombre</span>
                ) : (
                  <span className="text-text">{sale.customerName}</span>
                ),
            },
            {
              key: 'products',
              header: 'Productos',
              headerClassName: 'w-full',
              className: 'whitespace-normal',
              cell: (sale) => <span className="text-text-dim">{productsSummary(sale.items)}</span>,
            },
            {
              key: 'total',
              header: 'Total',
              align: 'right',
              cell: (sale) => (
                <span
                  className={
                    sale.status === 'VOID'
                      ? 'text-text-dim is-ruled-out font-mono tabular-nums'
                      : 'text-text font-mono font-semibold tabular-nums'
                  }
                >
                  ${sale.total}
                </span>
              ),
            },
            {
              key: 'methods',
              header: 'Método',
              cell: (sale) =>
                sale.payments.length === 0 ? (
                  <span className="text-text-faint">Sin pagos</span>
                ) : (
                  <SalePaymentsIcons payments={sale.payments} />
                ),
            },
            {
              key: 'status',
              header: 'Estado',
              stack: 'aside',
              cell: (sale) => <SaleStatusStamp status={sale.status} />,
            },
          ]}
        />
      </div>

      {pages > 1 ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-text-dim text-dense mr-auto">
            Página {page} de {pages}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={page <= 1 || sales.isFetching}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={page >= pages || sales.isFetching}
            onClick={() => setPage((current) => Math.min(pages, current + 1))}
          >
            Siguiente
          </Button>
        </div>
      ) : null}
    </div>
  );
}
