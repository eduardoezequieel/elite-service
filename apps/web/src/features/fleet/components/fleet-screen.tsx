'use client';

import { PERMISSIONS, VEHICLE_AVAILABILITY_LABELS } from '@elite/shared';
import type { FleetVehicle, VehicleAvailability } from '@elite/shared';
import { Plus, Search, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterChip } from '@/components/ui/filter-chip';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { WorkshopTextDialog } from '@/features/fleet-maintenance/components/workshop-text-dialog';
import { Pager } from '@/features/inventory/components/pager';
import { pageCount } from '@/features/inventory/format';
import { replaceParam } from '@/lib/list-params';
import { useUrlPage } from '@/lib/use-url-page';
import { availabilityCounts, sortByAvailability, workshopCount } from '../fleet-list';
import { useFleetVehicles } from '../hooks/use-fleet';
import { FleetVehicleCard } from './fleet-vehicle-card';
import { FleetVehicleDialog } from './fleet-vehicle-create-dialog';

/** El tope del API (115, RN-5): los conteos y filtros cubren los carros cargados. */
const PAGE_SIZE = 100;

/**
 * Los carros como garaje (115, simplificado en la 121): una sola grilla de
 * tarjetas con lo urgente primero, el buscador y un chip por estado. Los
 * retirados entran con su chip, al final.
 */
export function FleetScreen({
  initialPage = 1,
  initialRetired = false,
}: {
  initialPage?: number;
  initialRetired?: boolean;
}) {
  const { can } = usePermissions();
  const canRead = can(PERMISSIONS.fleet.actions.read.key);
  const canManage = can(PERMISSIONS.fleet.actions.manage.key);
  const canReports = can(PERMISSIONS.rentals.actions.reports.key);
  const [retired, setRetired] = useState(initialRetired);
  const [status, setStatus] = useState<VehicleAvailability | null>(null);
  const [term, setTerm] = useState('');
  const [page, setPage] = useUrlPage('page', initialPage, retired ? 'RETIRED' : 'fleet');
  const active = useFleetVehicles({ page: retired ? 1 : page, pageSize: PAGE_SIZE }, canRead);
  const retiredCount = useFleetVehicles({ status: 'RETIRED', pageSize: 1 }, canRead);
  const retiredList = useFleetVehicles(
    { status: 'RETIRED', page, pageSize: PAGE_SIZE },
    canRead && retired,
  );
  const [creating, setCreating] = useState(false);
  const [workshop, setWorkshop] = useState(false);

  const activeCars = active.data?.items ?? [];
  const shown = retired ? retiredList : active;
  const loaded = shown.data?.items ?? [];
  const visible = sortByAvailability(
    loaded.filter(
      (vehicle) =>
        (retired || status === null || vehicle.availability === status) && matches(vehicle, term),
    ),
  );
  const toWorkshop = workshopCount(activeCars);
  const retiredTotal = retiredCount.data?.total ?? 0;

  const choose = (next: VehicleAvailability | null, nextRetired: boolean) => {
    setStatus(next);
    if (nextRetired !== retired) {
      setRetired(nextRetired);
      replaceParam('status', nextRetired ? 'RETIRED' : null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader title="Carros">
        {canRead && toWorkshop > 0 ? (
          <Button type="button" variant="outline" onClick={() => setWorkshop(true)}>
            <Wrench className="size-icon" strokeWidth={1.5} aria-hidden />
            Mandar al taller
            <span className="text-text-faint tabular-nums">{toWorkshop}</span>
          </Button>
        ) : null}
        {canReports ? (
          <Link href="/rentals/fleet/earnings" className={buttonVariants({ variant: 'outline' })}>
            ¿Cuánto dejó?
          </Link>
        ) : null}
        {canManage ? (
          <Button type="button" onClick={() => setCreating(true)}>
            <Plus className="size-icon" strokeWidth={1.5} aria-hidden />
            Nuevo carro
          </Button>
        ) : null}
      </ScreenHeader>

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
        <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-1.5">
          <FilterChip
            pressed={!retired && status === null}
            count={active.data?.total ?? 0}
            onClick={() => choose(null, false)}
          >
            Todos
          </FilterChip>
          {availabilityCounts(activeCars).map(({ availability, count }) => (
            <FilterChip
              key={availability}
              pressed={!retired && status === availability}
              count={count}
              onClick={() => choose(availability, false)}
            >
              {VEHICLE_AVAILABILITY_LABELS[availability]}
            </FilterChip>
          ))}
          {retiredTotal > 0 ? (
            <FilterChip
              pressed={retired}
              count={retiredTotal}
              className="ml-2"
              onClick={() => choose(null, true)}
            >
              Retirados
            </FilterChip>
          ) : null}
        </div>
      </div>

      <FleetCards
        vehicles={visible}
        isLoading={shown.isPending}
        errorMessage={shown.error?.message ?? null}
        filtered={loaded.length > 0}
      />
      {shown.data !== undefined && pageCount(shown.data) > 1 ? (
        <Pager page={shown.data} noun={{ one: 'carro', many: 'carros' }} onPageChange={setPage} />
      ) : null}

      {creating ? <FleetVehicleDialog onClose={() => setCreating(false)} /> : null}
      {workshop ? <WorkshopTextDialog onClose={() => setWorkshop(false)} /> : null}
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

function FleetCards({
  vehicles,
  isLoading,
  errorMessage,
  filtered,
}: {
  vehicles: readonly FleetVehicle[];
  isLoading: boolean;
  errorMessage: string | null;
  filtered: boolean;
}) {
  const grid = 'grid grid-cols-[repeat(auto-fill,minmax(min(var(--card-min),100%),1fr))] gap-3.5';

  if (isLoading) {
    return (
      <div className={grid}>
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className="h-[calc(var(--stage-h)+11rem)] rounded-card" />
        ))}
      </div>
    );
  }
  if (errorMessage !== null)
    return <EmptyState title="No se pudo cargar" description={errorMessage} />;
  if (vehicles.length === 0)
    return <EmptyState title={filtered ? 'Ningún carro coincide' : 'Nada todavía'} />;

  return (
    <div className={grid}>
      {vehicles.map((vehicle) => (
        <FleetVehicleCard key={vehicle.id} vehicle={vehicle} />
      ))}
    </div>
  );
}
