'use client';

import { fleetVehicleName } from '@elite/shared';
import type { FleetVehicle } from '@elite/shared';

import { Combobox } from '@/components/ui/combobox';
import { useFleetVehicleOptions } from '@/features/fleet/hooks/use-fleet';

/** «P53DBC · Toyota Yaris 2022». */
export function vehicleOptionLabel(
  vehicle: Pick<FleetVehicle, 'plate' | 'make' | 'model' | 'year'>,
) {
  const name = fleetVehicleName(vehicle);

  return vehicle.plate === null ? name : `${vehicle.plate} · ${name}`;
}

/** Elegir un carro de la flota que no esté retirado. */
export function VehicleSelect({
  id,
  value,
  onChange,
  onBlur,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (vehicleId: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
}) {
  const vehicles = useFleetVehicleOptions();
  const options = (vehicles.data ?? [])
    .filter((vehicle) => vehicle.status !== 'RETIRED' || vehicle.id === value)
    .map((vehicle) => ({ value: vehicle.id, label: vehicleOptionLabel(vehicle) }));

  return (
    <Combobox
      id={id}
      label="Carro"
      placeholder={vehicles.isPending ? 'Cargando la flota…' : 'Elegí el carro'}
      options={options}
      value={value}
      onChange={(next) => onChange(next)}
      onBlur={onBlur}
      invalid={invalid}
      emptyText="No hay carros en la flota."
    />
  );
}
