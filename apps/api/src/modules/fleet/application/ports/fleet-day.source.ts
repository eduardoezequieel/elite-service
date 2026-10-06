import type { FleetDayContext } from '../../domain/fleet-day';

export type { OpenAgreement, FleetDayContext } from '../../domain/fleet-day';
export { DEFAULT_DAYS_ALERT, DEFAULT_KM_ALERT, EMPTY_FLEET_DAY } from '../../domain/fleet-day';

export interface FleetDaySource {
  /** El día de esos carros. Lista vacía: igual trae los avisos de los ajustes. */
  load(vehicleIds: readonly string[]): Promise<FleetDayContext>;
}

export const FLEET_DAY_SOURCE = Symbol('fleet.FleetDaySource');
