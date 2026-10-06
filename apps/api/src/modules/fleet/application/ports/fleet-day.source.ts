import type { MaintenancePlanTask } from '@elite/shared';

import type { LastService } from '../../../fleet-maintenance/domain/vehicle-status';
import type { DayAgreement } from '../../../rentals/domain/vehicle-availability';

/** Una renta abierta, con el carro al que pertenece. */
export interface OpenAgreement extends DayAgreement {
  vehicleId: string;
}

/**
 * Lo que el día de un carro necesita y no vive en la fila de la flota (110):
 * rentas abiertas, plan activo, último servicio por tarea y los avisos.
 */
export interface FleetDayContext {
  agreements: OpenAgreement[];
  plan: MaintenancePlanTask[];
  lastServices: LastService[];
  kmAlert: number;
  daysAlert: number;
}

export const EMPTY_FLEET_DAY: FleetDayContext = {
  agreements: [],
  plan: [],
  lastServices: [],
  kmAlert: 500,
  daysAlert: 7,
};

export interface FleetDaySource {
  /** El día de esos carros. Lista vacía: igual trae los avisos de los ajustes. */
  load(vehicleIds: readonly string[]): Promise<FleetDayContext>;
}

export const FLEET_DAY_SOURCE = Symbol('fleet.FleetDaySource');
