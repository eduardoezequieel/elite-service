'use client';

import { PERMISSIONS, fleetVehicleName } from '@elite/shared';
import { Car, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FilterChip } from '@/components/ui/filter-chip';
import { PlateChip } from '@/components/ui/plate-chip';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useFleetVehicleOptions } from '@/features/fleet/hooks/use-fleet';
import { Pager } from '@/features/inventory/components/pager';
import { todayCivil } from '@/lib/civil-date';
import { replaceParam } from '@/lib/list-params';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useUrlPage } from '@/lib/use-url-page';
import {
  HISTORY_PAGE_SIZE,
  historyFilter,
  historyMonth,
  historyQuery,
  monthOf,
  monthTitle,
  shiftMonth,
  type HistoryFilter,
} from '../agreement-history';
import { useAgreements } from '../hooks/use-agreements';
import { contractReference, historyColumns } from './agreement-columns';
import { AgreementSearch, BAHIA_CARDS, FILTER_CHIP_SPREAD } from './agreement-list-parts';

const COLUMNS = historyColumns();

const CHIPS: { filter: HistoryFilter; label: string }[] = [
  { filter: 'ALL', label: 'Todas' },
  { filter: 'FINISHED', label: 'Cerradas' },
  { filter: 'CANCELLED', label: 'Canceladas' },
];

/**
 * El Historial (117): lo cerrado y lo cancelado, de un mes a la vez y de a 15.
 * El mes, el estado y el carro viven en la URL (`?month=`, `?status=`,
 * `?vehicle=`), así que la ficha que se abre desde acá vuelve al mismo mes.
 * Con texto en el buscador se ignora el mes y se ocultan sus flechas.
 */
export function HistoryScreen({
  initialPage = 1,
  initialMonth = null,
  initialStatus = null,
  initialVehicle = null,
}: {
  initialPage?: number;
  initialMonth?: string | null;
  initialStatus?: string | null;
  initialVehicle?: string | null;
}) {
  const { can } = usePermissions();
  const [today] = useState(() => todayCivil());
  const current = monthOf(today);
  const [month, setMonth] = useState(() => historyMonth(initialMonth, today));
  const [filter, setFilter] = useState<HistoryFilter>(() => historyFilter(initialStatus));
  const [vehicleId, setVehicleId] = useState<string | null>(initialVehicle);
  const [term, setTerm] = useState('');
  const search = useDebouncedValue(term.trim());
  const vehicles = useFleetVehicleOptions({}, can(PERMISSIONS.fleet.actions.read.key));
  const vehicle = vehicles.data?.find((candidate) => candidate.id === vehicleId) ?? null;

  const query = historyQuery({ filter, month, vehicleId, search });
  const [page, setPage] = useUrlPage('page', initialPage, JSON.stringify(query));
  const agreements = useAgreements({ ...query, page, pageSize: HISTORY_PAGE_SIZE });
  const total = agreements.data?.total;

  function moveMonth(count: number) {
    const next = shiftMonth(month, count);
    if (next > current) return;
    setMonth(next);
    replaceParam('month', next === current ? null : next);
  }

  function chooseFilter(next: HistoryFilter) {
    setFilter(next);
    replaceParam('status', next === 'ALL' ? null : next);
  }

  function chooseVehicle(next: string | null) {
    setVehicleId(next);
    replaceParam('vehicle', next);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <AgreementSearch
          id="history-search"
          value={term}
          onChange={setTerm}
          placeholder="Placa, cliente o contrato"
        />

        <div className="flex flex-wrap items-center gap-2">
          {CHIPS.map((chip) => (
            <FilterChip
              key={chip.filter}
              pressed={filter === chip.filter}
              className={FILTER_CHIP_SPREAD}
              onClick={() => chooseFilter(chip.filter)}
            >
              {chip.label}
            </FilterChip>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <FilterChip pressed={vehicleId !== null} className={FILTER_CHIP_SPREAD}>
                <Car className="size-icon shrink-0" strokeWidth={1.5} aria-hidden />
                {vehicle === null ? 'Todos los carros' : fleetVehicleName(vehicle)}
                <ChevronDown className="size-icon shrink-0" strokeWidth={1.5} aria-hidden />
              </FilterChip>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
              <DropdownMenuItem onSelect={() => chooseVehicle(null)}>
                Todos los carros
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {(vehicles.data ?? []).map((option) => (
                <DropdownMenuItem key={option.id} onSelect={() => chooseVehicle(option.id)}>
                  {option.plate === null ? null : <PlateChip plate={option.plate} size="sm" />}
                  {fleetVehicleName(option)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {search === '' ? (
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => moveMonth(-1)}
                aria-label="Mes anterior"
              >
                <ChevronLeft className="size-icon" strokeWidth={1.5} aria-hidden />
              </Button>
              <span className="text-body text-text min-w-40 text-center font-semibold [[data-density=bahia]_&]:text-(length:--lead-size)">
                {monthTitle(month)}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={month >= current}
                onClick={() => moveMonth(1)}
                aria-label="Mes siguiente"
              >
                <ChevronRight className="size-icon" strokeWidth={1.5} aria-hidden />
              </Button>
            </div>
          ) : (
            <span />
          )}
          {total === undefined ? null : (
            <span className="text-text-dim text-dense tabular-nums" role="status">
              <span className="text-text font-semibold">{total}</span>{' '}
              {total === 1 ? 'renta' : 'rentas'}
            </span>
          )}
        </div>
      </div>

      <div className={BAHIA_CARDS}>
        <DataTable
          rows={agreements.data?.items ?? []}
          rowKey={(agreement) => agreement.id}
          referenceHeader="Contrato"
          renderReference={contractReference}
          rowHref={(agreement) => `/rentals/agreements/${agreement.id}`}
          isLoading={agreements.isPending}
          errorMessage={agreements.error?.message ?? null}
          emptyTitle={search === '' ? 'Nada este mes' : 'Sin resultados'}
          emptyMessage=""
          columns={COLUMNS}
        />
      </div>

      <Pager
        page={agreements.data}
        noun={{ one: 'renta', many: 'rentas' }}
        onPageChange={setPage}
      />
    </div>
  );
}
