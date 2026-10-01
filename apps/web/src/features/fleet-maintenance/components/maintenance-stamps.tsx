'use client';

import { FLEET_EXPENSE_SOURCE_LABELS, MAINTENANCE_STATUS_LABELS } from '@elite/shared';
import type { FleetExpenseSource, FleetVehicleRef, MaintenanceStatus } from '@elite/shared';
import { fleetVehicleName } from '@elite/shared';

import { PlateChip } from '@/components/ui/plate-chip';
import { Stamp } from '@/components/ui/stamp';
import { EXPENSE_SOURCE_TONE, MAINTENANCE_STATUS_TONE } from '../maintenance-view';

/** El estado de una tarea o un documento: palabra y tono, nunca solo color. */
export function MaintenanceStatusStamp({ status }: { status: MaintenanceStatus }) {
  return <Stamp tone={MAINTENANCE_STATUS_TONE[status]} label={MAINTENANCE_STATUS_LABELS[status]} />;
}

/** De dónde sale un gasto: manual, lavado o multa. */
export function ExpenseSourceStamp({ source }: { source: FleetExpenseSource }) {
  return <Stamp tone={EXPENSE_SOURCE_TONE[source]} label={FLEET_EXPENSE_SOURCE_LABELS[source]} />;
}

/** Un carro en una fila: placa y nombre. */
export function VehicleCell({ vehicle }: { vehicle: FleetVehicleRef }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      {vehicle.plate === null ? (
        <span className="text-text-faint text-dense">Sin placa</span>
      ) : (
        <PlateChip plate={vehicle.plate} size="sm" />
      )}
      <span className="text-body font-semibold">{fleetVehicleName(vehicle)}</span>
    </span>
  );
}
