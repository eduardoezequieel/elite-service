import { civilDateOfInstant, fleetAlerts } from '@elite/shared';
import type { FleetVehicle } from '@elite/shared';

import { vehicleMaintenanceStatus } from '../../fleet-maintenance/domain/vehicle-status';
import { vehicleAvailability } from '../../rentals/domain/vehicle-availability';
import type { FleetDayContext } from './fleet-day';

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
    alerts: fleetAlerts({
      tasks: maintenance.tasks,
      documents: maintenance.documents,
      odometerKm: vehicle.odometerKm,
      today,
    }),
  };
}
