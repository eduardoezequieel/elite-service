'use client';

import { PERMISSIONS, fleetVehicleName } from '@elite/shared';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { PlateChip } from '@/components/ui/plate-chip';
import { DetailSkeleton } from '@/components/ui/skeleton';
import { Tabs } from '@/components/ui/tabs';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import {
  FLEET_VEHICLE_SECTIONS,
  fleetVehicleSectionFor,
  type FleetVehicleSection,
} from '../frame-section';
import { useFleetVehicle } from '../hooks/use-fleet';
import { FleetStatusActions } from './fleet-status-actions';
import { FleetStatusStamp } from './fleet-status-stamp';

/**
 * El marco de la ficha de un carro (095, patrón 092): la misma cabecera y las
 * mismas cuatro pestañas —Ficha, Mantenimiento, Gastos y Meses— en todas sus
 * rutas. Lo monta una sola vez `app/(app)/rentals/fleet/[id]/(tabs)/layout.tsx`:
 * cambiar de pestaña cambia solo el hijo. La pestaña activa sale de la ruta.
 *
 * Mantenimiento y Gastos los llena la 099; Meses, la 100. Sin «Editar»
 * general (103): el encabezado lleva solo el estado, y cada tarjeta de la
 * Ficha se edita por su cuenta.
 */
export function FleetVehicleFrame({ id, children }: { id: string; children: ReactNode }) {
  const router = useRouter();
  const section = fleetVehicleSectionFor(usePathname());
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.fleet.actions.manage.key);
  const vehicle = useFleetVehicle(id);

  if (vehicle.isPending) return <DetailSkeleton label="Cargando el carro" />;

  if (vehicle.error !== null || vehicle.data === undefined) {
    return (
      <p className="text-danger-text text-body" role="alert">
        {vehicle.error?.message ?? 'No se pudo cargar el carro.'}
      </p>
    );
  }

  const data = vehicle.data;

  return (
    <div>
      <ScreenHeader
        title={fleetVehicleName(data)}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {data.plate === null ? (
              <span className="text-text-faint">Sin placa</span>
            ) : (
              <PlateChip plate={data.plate} size="sm" />
            )}
            <FleetStatusStamp status={data.status} />
          </span>
        }
      >
        {canManage ? <FleetStatusActions vehicle={data} /> : null}
      </ScreenHeader>

      <Tabs<FleetVehicleSection>
        aria-label="Ficha del carro"
        className="mb-5"
        value={section}
        onValueChange={(next) => {
          const target = FLEET_VEHICLE_SECTIONS.find((candidate) => candidate.value === next);
          if (target !== undefined && next !== section) {
            router.push(`/rentals/fleet/${id}${target.suffix}`);
          }
        }}
        items={FLEET_VEHICLE_SECTIONS}
      />

      <div role="tabpanel" id={`tabpanel-${section}`} aria-labelledby={`tab-${section}`}>
        {children}
      </div>
    </div>
  );
}
