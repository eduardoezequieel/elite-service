'use client';

import { VEHICLE_AVAILABILITY_LABELS } from '@elite/shared';
import type { FleetVehicle, VehicleAvailability } from '@elite/shared';
import { useState } from 'react';

import { EmptyState } from '@/components/ui/empty-state';
import { FilterChip } from '@/components/ui/filter-chip';
import { Skeleton } from '@/components/ui/skeleton';
import { FleetVehicleCard } from '@/features/fleet/components/fleet-vehicle-card';
import { availabilityCounts, sortByAvailability } from '@/features/fleet/fleet-list';

const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(min(var(--card-min),100%),1fr))] gap-3.5';

/**
 * La flota de Hoy (125): los mismos chips y tarjetas de `/rentals/fleet`,
 * sin buscador ni retirados. El tope del API es una página de 100.
 */
export function TodayFleet({
  vehicles,
  total,
  isLoading,
  errorMessage,
}: {
  vehicles: readonly FleetVehicle[];
  total: number;
  isLoading: boolean;
  errorMessage: string | null;
}) {
  const [status, setStatus] = useState<VehicleAvailability | null>(null);
  const counts = availabilityCounts(vehicles);
  const selected =
    status !== null && counts.some((entry) => entry.availability === status) ? status : null;
  const visible = sortByAvailability(
    vehicles.filter((vehicle) => selected === null || vehicle.availability === selected),
  );

  return (
    <section aria-label="Flota" className="flex flex-col gap-3.5">
      <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-1.5">
        <FilterChip pressed={selected === null} count={total} onClick={() => setStatus(null)}>
          Todos
        </FilterChip>
        {counts.map(({ availability, count }) => (
          <FilterChip
            key={availability}
            pressed={selected === availability}
            count={count}
            onClick={() => setStatus(availability)}
          >
            {VEHICLE_AVAILABILITY_LABELS[availability]}
          </FilterChip>
        ))}
      </div>

      <FleetCards
        vehicles={visible}
        isLoading={isLoading}
        errorMessage={errorMessage}
        filtered={selected !== null && vehicles.length > 0}
      />
    </section>
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
  if (isLoading) {
    return (
      <div className={GRID}>
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className="h-[calc(var(--stage-h)+11rem)] rounded-card" />
        ))}
      </div>
    );
  }
  if (errorMessage !== null) {
    return <EmptyState title="No se pudo cargar" description={errorMessage} />;
  }
  if (vehicles.length === 0) {
    return <EmptyState title={filtered ? 'Ningún carro coincide' : 'Nada todavía'} />;
  }

  return (
    <div className={GRID}>
      {vehicles.map((vehicle) => (
        <FleetVehicleCard key={vehicle.id} vehicle={vehicle} />
      ))}
    </div>
  );
}
