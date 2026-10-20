'use client';

import { PERMISSIONS, fleetVehicleName } from '@elite/shared';
import { Receipt } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { PlateChip } from '@/components/ui/plate-chip';
import { DetailSkeleton } from '@/components/ui/skeleton';
import { Tabs } from '@/components/ui/tabs';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { FineDialog } from '@/features/rental-billing/components/fine-dialog';
import {
  FLEET_VEHICLE_SECTIONS,
  fleetVehicleSectionFor,
  type FleetVehicleSection,
} from '../frame-section';
import { useFleetVehicle } from '../hooks/use-fleet';
import { FleetAlertList } from './fleet-alert-list';
import { FleetAvailabilityStamp } from './fleet-availability-stamp';
import { FleetStatusActions } from './fleet-status-actions';
import { FleetStatusStamp } from './fleet-status-stamp';

/**
 * El marco de la ficha de un carro (095, patrón 092): la misma cabecera y las
 * mismas pestañas —Ficha, Servicio y gastos (122) y ¿Cuánto dejó?— en todas sus
 * rutas. Lo monta una sola vez `app/(app)/rentals/fleet/[id]/(tabs)/layout.tsx`:
 * cambiar de pestaña cambia solo el hijo. La pestaña activa sale de la ruta.
 *
 * ¿Cuánto dejó? pide `rentals.reports` (110). Sin «Editar» general (103):
 * el encabezado lleva el día y los avisos —con el mismo `FleetAlertList` de la
 * tarjeta (121)—, y cada tarjeta de la Ficha se edita por su cuenta. Vuelve
 * siempre a Carros. «Multa» (127 RN-4) pide `rentals.charge`.
 */
export function FleetVehicleFrame({ id, children }: { id: string; children: ReactNode }) {
  const router = useRouter();
  const section = fleetVehicleSectionFor(usePathname());
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.fleet.actions.manage.key);
  const canReports = can(PERMISSIONS.rentals.actions.reports.key);
  // 127 RN-4: la multa que llega después se carga desde el carro.
  const canFine = can(PERMISSIONS.rentals.actions.charge.key);
  const [fining, setFining] = useState(false);
  const sections = FLEET_VEHICLE_SECTIONS.filter((item) => item.value !== 'months' || canReports);
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
          <div className="flex flex-col gap-2">
            <span className="flex flex-wrap items-center gap-2">
              {data.plate === null ? (
                <span className="text-text-faint">Sin placa</span>
              ) : (
                <PlateChip plate={data.plate} size="sm" />
              )}
              <FleetAvailabilityStamp availability={data.availability} />
              {data.availability === 'WORKSHOP' ? null : <FleetStatusStamp status={data.status} />}
            </span>
            <FleetAlertList alerts={data.alerts} />
          </div>
        }
      >
        {canFine ? (
          <Button type="button" variant="outline" onClick={() => setFining(true)}>
            <Receipt className="size-icon" strokeWidth={1.5} aria-hidden />
            Multa
          </Button>
        ) : null}
        {canManage ? <FleetStatusActions vehicle={data} /> : null}
      </ScreenHeader>
      {fining ? (
        <FineDialog
          target={{
            kind: 'vehicle',
            vehicleId: data.id,
            vehicleLabel: [fleetVehicleName(data), data.plate].filter(Boolean).join(' · '),
          }}
          onClose={() => setFining(false)}
        />
      ) : null}

      <Tabs<FleetVehicleSection>
        aria-label="Ficha del carro"
        chipsOnBahia
        className="mb-5"
        value={section}
        onValueChange={(next) => {
          const target = sections.find((candidate) => candidate.value === next);
          if (target !== undefined && next !== section) {
            router.push(`/rentals/fleet/${id}${target.suffix}`);
          }
        }}
        items={sections}
      />

      <div role="tabpanel" id={`tabpanel-${section}`} aria-labelledby={`tab-${section}`}>
        {children}
      </div>
    </div>
  );
}
