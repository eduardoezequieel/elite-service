import { civilDateOfInstant, fleetAlerts } from '@elite/shared';
import type { FleetVehicle, FleetVehicleActivity } from '@elite/shared';

import { vehicleMaintenanceStatus } from '../../fleet-maintenance/domain/vehicle-status';
import { vehicleAvailability } from '../../rentals/domain/vehicle-availability';
import type { VehicleDayState } from '../../rentals/domain/vehicle-availability';
import type { FleetDayContext, OpenAgreement } from './fleet-day';

/**
 * spec 110, RN-1 — El estado del día y los avisos de un carro.
 *
 * `vehicleAvailability` es la de Hoy (107). Los avisos salen del mismo estado
 * de mantenimiento (099). La web no vuelve a calcular nada de esto.
 */
export function attachFleetDay(
  vehicle: FleetVehicle,
  context: FleetDayContext,
  now: Date,
): FleetVehicle {
  const agreements = context.agreements.filter((agreement) => agreement.vehicleId === vehicle.id);
  const state = vehicleAvailability(vehicle, agreements, now);
  const today = civilDateOfInstant(now);
  const maintenance = vehicleMaintenanceStatus({
    vehicle: {
      id: vehicle.id,
      plate: vehicle.plate,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      odometerKm: vehicle.odometerKm,
      status: vehicle.status,
      insuranceExpiresAt: vehicle.insuranceExpiresAt,
      registrationExpiresAt: vehicle.registrationExpiresAt,
    },
    plan: context.plan.filter((task) => task.isActive),
    lastServices: context.lastServices.filter((service) => service.vehicleId === vehicle.id),
    trips: [],
    today,
    alerts: { kmAlert: context.kmAlert, daysAlert: context.daysAlert },
  });

  return {
    ...vehicle,
    availability: state?.availability ?? null,
    activity: fleetActivity(state, agreements),
    alerts: fleetAlerts({
      tasks: maintenance.tasks,
      documents: maintenance.documents,
      odometerKm: vehicle.odometerKm,
      today,
    }),
  };
}

/**
 * spec 115, RN-1 — Qué está pasando con el carro. Sale de la misma renta que
 * decide el día: una en curso dice cuándo vuelve; una reserva, cuándo sale.
 * Un carro libre con una reserva futura dice cuándo sale la más próxima. El
 * taller no guarda motivo ni fecha: `null`.
 */
export function fleetActivity(
  state: VehicleDayState | null,
  agreements: readonly OpenAgreement[],
): FleetVehicleActivity | null {
  if (state === null || state.availability === 'WORKSHOP') return null;

  const agreement =
    state.agreementId === null
      ? agreements
          .filter((candidate) => candidate.status === 'RESERVED')
          .sort((left, right) => left.plannedPickupAt.localeCompare(right.plannedPickupAt))[0]
      : agreements.find((candidate) => candidate.id === state.agreementId);

  if (agreement === undefined) return null;

  return agreement.status === 'IN_PROGRESS'
    ? { kind: 'RETURN', at: agreement.plannedReturnAt, customerName: agreement.customerName }
    : { kind: 'PICKUP', at: agreement.plannedPickupAt, customerName: agreement.customerName };
}
