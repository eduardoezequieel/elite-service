'use client';

import { PERMISSIONS, type TabListItem } from '@elite/shared';
import { Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { FieldBox } from '@/components/ui/field-box';
import { FilterChip } from '@/components/ui/filter-chip';
import { FilterBar } from '@/components/ui/filters-popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatCard } from '@/components/ui/stat-card';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { pagedReference } from '@/features/inventory/format';
import { Pager } from '@/features/inventory/components/pager';
import { LIST_PAGE_SIZE, replaceQuery } from '@/lib/list-params';
import { moneyParts } from '@/lib/money';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useTabs } from '../hooks/use-tabs';
import {
  TABS_FILTERS,
  tabsEmptyTitle,
  tabsFilterCount,
  tabsFilterQuery,
  tabsListQuery,
  unitsLabel,
  type TabsFilter,
  type TabsListState,
} from '../tab-format';
import { HolderAvatar } from './holder-avatar';
import { OpenTabDialog } from './open-tab-dialog';
import { HolderKindStamp, TabClosedStamp } from './tab-stamps';

const EMPTY_TABS: TabListItem[] = [];

/**
 * `/sales/tabs`, «Cuentas abiertas» (106): quién debe y cuánto.
 *
 * Arriba las tres cifras de todas las abiertas —sin filtro ni búsqueda—, debajo
 * el buscador, los chips y «Abrir cuenta», y la lista por saldo. La fila entera
 * abre la cuenta. Filtro, búsqueda y página viven en la URL; al volver de
 * anotar, la cuenta tocada destella una vez (`highlight`).
 */
export function TabsScreen({
  initial,
  highlight: initialHighlight,
}: {
  initial: TabsListState;
  highlight: string | null;
}) {
  const { can } = usePermissions();
  const canCharge = can(PERMISSIONS.carwash.actions.charge.key);
  const [filter, setFilter] = useState<TabsFilter>(initial.filter);
  const [term, setTerm] = useState(initial.search);
  const [page, setPage] = useState(initial.page);
  const [highlight, setHighlight] = useState(initialHighlight);
  const [opening, setOpening] = useState(false);
  const search = useDebouncedValue(term.trim());

  // Otra búsqueda vuelve a la primera página y apaga el resaltado.
  const [searched, setSearched] = useState(search);
  if (searched !== search) {
    setSearched(search);
    setPage(1);
    setHighlight(null);
  }

  useEffect(() => {
    replaceQuery(tabsListQuery({ filter, search, page }));
  }, [filter, search, page]);

  const tabs = useTabs({
    ...tabsFilterQuery(filter),
    ...(search === '' ? {} : { search }),
    page,
    pageSize: LIST_PAGE_SIZE,
  });
  const summary = tabs.data?.summary;
  const rows = tabs.data?.tabs.items ?? EMPTY_TABS;
  const owed = moneyParts(summary?.owed ?? '0.00');
  const owedByEmployees = moneyParts(summary?.owedByEmployees ?? '0.00');
  const owedByCustomers = moneyParts(summary?.owedByCustomers ?? '0.00');
  const counting = summary === undefined;

  function pick(next: TabsFilter): void {
    setFilter(next);
    setPage(1);
    setHighlight(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3">
        <StatCard
          label="Por cobrar"
          tone="flame"
          value={counting ? '—' : owed.whole}
          unit={counting ? undefined : owed.fraction}
        />
        <StatCard
          label="Trabajadores"
          value={counting ? '—' : owedByEmployees.whole}
          unit={counting ? undefined : owedByEmployees.fraction}
        />
        <StatCard
          className="col-span-2 md:col-span-1"
          label="Clientes"
          value={counting ? '—' : owedByCustomers.whole}
          unit={counting ? undefined : owedByCustomers.fraction}
        />
      </div>

      <FilterBar className="items-center">
        <div className="min-w-0 max-w-sm flex-1 basis-60">
          <FieldBox className="h-full">
            <Label htmlFor="tabs-search">Buscar</Label>
            <div className="flex items-center gap-2">
              <Search
                className="text-text-faint size-icon shrink-0"
                strokeWidth={1.5}
                aria-hidden
              />
              <Input
                id="tabs-search"
                type="search"
                className="min-w-0 flex-1"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Nombre o C-0012"
                autoComplete="off"
              />
            </div>
          </FieldBox>
        </div>

        <div role="group" aria-label="Qué cuentas" className="flex flex-wrap gap-2">
          {TABS_FILTERS.map((option) => (
            <FilterChip
              key={option.value}
              pressed={filter === option.value}
              count={summary === undefined ? undefined : tabsFilterCount(summary, option.value)}
              onClick={() => pick(option.value)}
            >
              {option.label}
            </FilterChip>
          ))}
        </div>

        {canCharge ? (
          <Button
            type="button"
            variant="outline"
            className="ml-auto"
            onClick={() => setOpening(true)}
          >
            <Plus aria-hidden strokeWidth={1.5} />
            Abrir cuenta
          </Button>
        ) : null}
      </FilterBar>

      <DataTable
        rows={rows}
        rowKey={(tab) => tab.id}
        rowHref={(tab) => `/sales/tabs/${tab.id}`}
        reference={(_tab, index) => pagedReference(tabs.data?.tabs, index)}
        highlightKey={highlight}
        isLoading={tabs.isPending}
        errorMessage={tabs.error?.message ?? null}
        emptyTitle={tabsEmptyTitle(filter, search)}
        emptyMessage=""
        columns={[
          {
            key: 'holder',
            header: 'Cuenta',
            stack: 'title',
            headerClassName: 'w-full',
            cell: (tab) => (
              <span className="flex min-w-0 items-center gap-3">
                <HolderAvatar name={tab.holder.fullName} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-text font-semibold [[data-density=bahia]_&]:text-title">
                    {tab.holder.fullName}
                  </span>
                  <span className="text-text-faint text-dense">
                    <span className="font-mono">{tab.number}</span> · {unitsLabel(tab.units)}
                  </span>
                </span>
              </span>
            ),
          },
          {
            key: 'kind',
            header: 'Tipo',
            stack: 'aside',
            className: 'whitespace-nowrap',
            cell: (tab) => <HolderKindStamp kind={tab.holder.kind} />,
          },
          {
            key: 'balance',
            header: filter === 'CLOSED' ? 'Estado' : 'Debe',
            align: 'right',
            className: 'whitespace-nowrap',
            cell: (tab) =>
              tab.status === 'CLOSED' ? (
                <TabClosedStamp tab={tab} />
              ) : (
                <span className="text-text font-mono text-body font-semibold tabular-nums [[data-density=bahia]_&]:text-title">
                  ${tab.balance}
                </span>
              ),
          },
        ]}
      />

      <Pager
        page={tabs.data?.tabs}
        noun={{ one: 'cuenta', many: 'cuentas' }}
        onPageChange={(next) => {
          setPage(next);
          setHighlight(null);
        }}
      />

      {opening ? <OpenTabDialog onOpenChange={setOpening} /> : null}
    </div>
  );
}
