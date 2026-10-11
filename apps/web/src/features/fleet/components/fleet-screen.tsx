'use client';

import {
  FLEET_CATEGORY_LABELS,
  FLEET_VEHICLE_CATEGORIES,
  PERMISSIONS,
  VEHICLE_AVAILABILITY_LABELS,
  fleetVehicleName,
} from '@elite/shared';
import type { FleetVehicle, FleetVehicleCategory, VehicleAvailability } from '@elite/shared';
import { LayoutGrid, List, MoreHorizontal, Plus, Search } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterChip } from '@/components/ui/filter-chip';
import { Input } from '@/components/ui/input';
import { PlateChip } from '@/components/ui/plate-chip';
import { SegmentGauge } from '@/components/ui/segment-gauge';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { MaintenancePlanDialog } from '@/features/fleet-maintenance/components/maintenance-plan-dialog';
import { Pager } from '@/features/inventory/components/pager';
import { pagedReference } from '@/features/inventory/format';
import { centsToAmount, formatMoney, toCents } from '@/lib/money';
import { replaceParam } from '@/lib/list-params';
import { useUrlPage } from '@/lib/use-url-page';
import { cn } from '@/lib/utils';
import { useFleetVehicles } from '../hooks/use-fleet';
import { FleetAlertsStamp, FleetAvailabilityStamp } from './fleet-availability-stamp';
import { FleetVehicleCard } from './fleet-vehicle-card';
import { FleetViewSwitch } from './fleet-view-switch';
import { FleetVehicleDialog } from './fleet-vehicle-create-dialog';

/** El tope del API (115, RN-5): los conteos y filtros cubren los carros cargados. */
const PAGE_SIZE = 100;

/** Lo urgente primero (115). */
const AVAILABILITY_ORDER: readonly VehicleAvailability[] = [
  'OVERDUE',
  'RENTED',
  'RESERVED',
  'FREE',
  'WORKSHOP',
];

export type FleetView = 'cards' | 'list';

/**
 * Los carros como garaje (115): tarjetas con el carro en 3D agrupadas por
 * estado, la ocupación de la flota arriba y filtros por estado, tipo y texto.
 * «Lista» es la tabla de la 110. Los retirados entran con el chip «Retirados».
 */
export function FleetScreen({
  initialPage = 1,
  initialRetired = false,
  initialView = 'cards',
}: {
  initialPage?: number;
  initialRetired?: boolean;
  initialView?: FleetView;
}) {
  const { can } = usePermissions();
  const canRead = can(PERMISSIONS.fleet.actions.read.key);
  const canManage = can(PERMISSIONS.fleet.actions.manage.key);
  const canReports = can(PERMISSIONS.rentals.actions.reports.key);
  const [retired, setRetired] = useState(initialRetired);
  const [view, setView] = useState<FleetView>(initialView);
  const [status, setStatus] = useState<VehicleAvailability | null>(null);
  const [category, setCategory] = useState<FleetVehicleCategory | null>(null);
  const [term, setTerm] = useState('');
  const [page, setPage] = useUrlPage('page', initialPage, retired ? 'RETIRED' : 'fleet');
  const vehicles = useFleetVehicles(
    { page, pageSize: PAGE_SIZE, ...(retired ? { status: 'RETIRED' as const } : {}) },
    canRead,
  );
  const [creating, setCreating] = useState(false);
  const [plan, setPlan] = useState(false);

  const loaded = vehicles.data?.items ?? [];
  // La referencia es la del orden del API: no cambia al filtrar ni al agrupar.
  const references = new Map(
    loaded.map((vehicle, index) => [vehicle.id, pagedReference(vehicles.data, index)]),
  );
  const visible = loaded.filter(
    (vehicle) =>
      (retired || status === null || vehicle.availability === status) &&
      (category === null || vehicle.category === category) &&
      matches(vehicle, term),
  );

  const changeView = (next: FleetView) => {
    setView(next);
    replaceParam('view', next === 'list' ? 'list' : null);
  };

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader title="Carros">
        {canReports ? <FleetViewSwitch current="cars" /> : null}
        {canRead ? (
          <button
            type="button"
            aria-pressed={retired}
            onClick={() => {
              const next = !retired;
              setRetired(next);
              setStatus(null);
              replaceParam('status', next ? 'RETIRED' : null);
            }}
            className={cn(
              'border-line bg-surface-2 inline-flex min-h-(--touch-min) items-center rounded-control border px-4 text-body font-semibold',
              '[[data-density=bahia]_&]:px-5',
              retired ? 'border-flame text-text' : 'text-text-dim',
            )}
          >
            Retirados
          </button>
        ) : null}
        {canManage ? (
          <Button type="button" onClick={() => setCreating(true)}>
            <Plus className="size-icon" strokeWidth={1.5} aria-hidden />
            Nuevo carro
          </Button>
        ) : null}
        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="icon" aria-label="Más">
                <MoreHorizontal className="size-icon" strokeWidth={1.5} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setPlan(true)}>Plan de servicio</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </ScreenHeader>

      {retired ? null : <FleetPulse vehicles={loaded} status={status} onStatusChange={setStatus} />}

      <div className="flex flex-wrap items-center gap-2.5">
        <label className="border-line bg-surface-2 flex min-h-(--control-h) max-w-sm min-w-60 flex-1 items-center gap-2 rounded-control border px-3">
          <span className="sr-only">Buscar carro</span>
          <Search className="text-text-faint size-icon shrink-0" strokeWidth={1.5} aria-hidden />
          <Input
            className="min-w-0 flex-1 border-0 bg-transparent px-0 shadow-none"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Placa, marca o modelo"
            autoComplete="off"
          />
        </label>
        <div role="group" aria-label="Tipo de carro" className="flex flex-wrap gap-1.5">
          <FilterChip pressed={category === null} onClick={() => setCategory(null)}>
            Todos
          </FilterChip>
          {FLEET_VEHICLE_CATEGORIES.map((key) => (
            <FilterChip key={key} pressed={category === key} onClick={() => setCategory(key)}>
              {FLEET_CATEGORY_LABELS[key]}
            </FilterChip>
          ))}
        </div>
        <div
          role="group"
          aria-label="Cómo ver"
          className="border-line ml-auto inline-flex overflow-hidden rounded-control border"
        >
          <ViewButton
            label="Tarjetas"
            pressed={view === 'cards'}
            onClick={() => changeView('cards')}
          >
            <LayoutGrid className="size-icon" strokeWidth={1.5} aria-hidden />
          </ViewButton>
          <ViewButton label="Lista" pressed={view === 'list'} onClick={() => changeView('list')}>
            <List className="size-icon" strokeWidth={1.5} aria-hidden />
          </ViewButton>
        </div>
      </div>

      {view === 'list' ? (
        <DataTable<FleetVehicle>
          rows={visible}
          rowKey={(vehicle) => vehicle.id}
          reference={(vehicle) => references.get(vehicle.id) ?? 0}
          rowHref={(vehicle) => `/rentals/fleet/${vehicle.id}`}
          isLoading={vehicles.isPending}
          errorMessage={vehicles.error?.message ?? null}
          emptyTitle="Nada todavía"
          emptyMessage=""
          columns={[
            {
              key: 'vehicle',
              header: 'Carro',
              stack: 'title',
              className: 'whitespace-normal',
              cell: (vehicle) => (
                <span className="flex flex-col gap-1">
                  <span className="text-body font-semibold">{fleetVehicleName(vehicle)}</span>
                  {vehicle.plate === null ? (
                    <span className="text-text-faint text-dense">Sin placa</span>
                  ) : (
                    <PlateChip plate={vehicle.plate} size="sm" />
                  )}
                </span>
              ),
            },
            {
              key: 'rate',
              header: 'Por día',
              align: 'right',
              cell: (vehicle) => (
                <span className="font-mono tabular-nums">{formatMoney(vehicle.dailyRate)}</span>
              ),
            },
            {
              key: 'state',
              header: 'Estado',
              stack: 'aside',
              className: 'whitespace-nowrap',
              cell: (vehicle) => (
                <span className="flex flex-wrap items-center gap-1.5">
                  <FleetAvailabilityStamp availability={vehicle.availability} />
                  <FleetAlertsStamp alerts={vehicle.alerts} />
                </span>
              ),
            },
          ]}
        />
      ) : (
        <FleetCards
          vehicles={visible}
          references={references}
          grouped={!retired && status === null}
          isLoading={vehicles.isPending}
          errorMessage={vehicles.error?.message ?? null}
          filtered={loaded.length > 0}
        />
      )}
      <Pager page={vehicles.data} noun={{ one: 'carro', many: 'carros' }} onPageChange={setPage} />

      {creating ? <FleetVehicleDialog onClose={() => setCreating(false)} /> : null}
      {plan ? <MaintenancePlanDialog onClose={() => setPlan(false)} /> : null}
    </div>
  );
}

/** Placa, marca o modelo; la placa se compara sin guiones ni espacios. */
function matches(vehicle: FleetVehicle, term: string): boolean {
  const query = term.trim().toLowerCase();
  if (query === '') return true;

  const bare = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');
  const name = `${vehicle.make} ${vehicle.model}`.toLowerCase();

  return (
    name.includes(query) || (vehicle.plate !== null && bare(vehicle.plate).includes(bare(query)))
  );
}

/**
 * La fila de arriba (115): ocupación de la flota (En renta + Atrasado de todos
 * menos Taller), lo que suman por día y un filtro por estado con su cantidad.
 */
function FleetPulse({
  vehicles,
  status,
  onStatusChange,
}: {
  vehicles: readonly FleetVehicle[];
  status: VehicleAvailability | null;
  onStatusChange: (status: VehicleAvailability | null) => void;
}) {
  const out = vehicles.filter(
    (vehicle) => vehicle.availability === 'RENTED' || vehicle.availability === 'OVERDUE',
  );
  const fleet = vehicles.filter((vehicle) => vehicle.availability !== 'WORKSHOP').length;
  const perDay = centsToAmount(
    out.reduce((total, vehicle) => total + (toCents(vehicle.dailyRate) ?? 0), 0),
  );

  return (
    <section
      aria-label="Cómo está la flota hoy"
      className="border-line-soft flex flex-wrap items-center gap-x-7 gap-y-3.5 border-b pb-4.5"
    >
      <div className="flex items-center gap-3.5">
        <SegmentGauge value={out.length} max={fleet} label="Ocupación de la flota" />
        <div>
          <p className="text-text-faint text-label">
            Ocupación de la flota: {out.length} de {fleet}
          </p>
          <p className="font-display text-text text-(length:--stat-name-size) leading-tight font-bold italic tabular-nums">
            {formatMoney(perDay)}
          </p>
          <p className="text-text-faint text-label">Ingreso diario en renta</p>
        </div>
      </div>
      <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-1.5">
        {AVAILABILITY_ORDER.map((key) => (
          <FilterChip
            key={key}
            pressed={status === key}
            count={vehicles.filter((vehicle) => vehicle.availability === key).length}
            onClick={() => onStatusChange(status === key ? null : key)}
          >
            {VEHICLE_AVAILABILITY_LABELS[key]}
          </FilterChip>
        ))}
      </div>
    </section>
  );
}

function FleetCards({
  vehicles,
  references,
  grouped,
  isLoading,
  errorMessage,
  filtered,
}: {
  vehicles: readonly FleetVehicle[];
  references: ReadonlyMap<string, number>;
  grouped: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  filtered: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(var(--card-min),100%),1fr))] gap-3.5">
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className="h-[calc(var(--stage-h)+11rem)] rounded-card" />
        ))}
      </div>
    );
  }
  if (errorMessage !== null)
    return <EmptyState title="No se pudo cargar" description={errorMessage} />;
  if (vehicles.length === 0) {
    return filtered ? (
      <EmptyState
        title="Ningún carro coincide"
        description="Probá otra búsqueda o quitá el filtro."
      />
    ) : (
      <EmptyState title="Nada todavía" />
    );
  }

  const grid = (items: readonly FleetVehicle[]) => (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(var(--card-min),100%),1fr))] gap-3.5">
      {items.map((vehicle) => (
        <FleetVehicleCard
          key={vehicle.id}
          vehicle={vehicle}
          reference={references.get(vehicle.id) ?? 0}
        />
      ))}
    </div>
  );

  if (!grouped) return grid(vehicles);

  return (
    <div className="flex flex-col gap-6">
      {AVAILABILITY_ORDER.map((key) => {
        const group = vehicles.filter((vehicle) => vehicle.availability === key);
        if (group.length === 0) return null;

        return (
          <section
            key={key}
            aria-label={VEHICLE_AVAILABILITY_LABELS[key]}
            className="flex flex-col gap-3"
          >
            <h2 className="flex items-center gap-2.5">
              <FleetAvailabilityStamp availability={key} />
              <span className="font-display text-text-dim text-(length:--gauge-size) leading-none font-bold italic tabular-nums">
                {group.length}
              </span>
            </h2>
            {grid(group)}
          </section>
        );
      })}
    </div>
  );
}

function ViewButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'grid size-(--control-h) place-items-center',
        pressed
          ? 'bg-surface-3 text-text shadow-[inset_0_-2px_0_var(--flame)]'
          : 'bg-surface-2 text-text-dim',
      )}
    >
      {children}
    </button>
  );
}
