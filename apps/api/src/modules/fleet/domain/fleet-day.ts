import type { MaintenancePlanTask } from '@elite/shared';

import type { LastService } from '../../fleet-maintenance/domain/vehicle-status';
import type { DayAgreement } from '../../rentals/domain/vehicle-availability';

/** Km de aviso cuando los ajustes no traen uno (110). */
export const DEFAULT_KM_ALERT = 500;

/** Días de aviso cuando los ajustes no traen uno (110). */
export const DEFAULT_DAYS_ALERT = 7;

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
  kmAlert: DEFAULT_KM_ALERT,
  daysAlert: DEFAULT_DAYS_ALERT,
};
