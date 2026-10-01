import type { FinishedTrip, MaintenanceVehicle } from '../../domain/vehicle-status';

/**
 * Lo que el mantenimiento lee de la flota y de las rentas (099). Se lee directo
 * de `fleet_vehicles` y `rental_agreements`: el módulo no importa `rentals`.
 */
export interface FleetSnapshotSource {
  findVehicle(id: string): Promise<MaintenanceVehicle | null>;
  /** Los carros que no están retirados, por marca y modelo. */
  activeVehicles(): Promise<MaintenanceVehicle[]>;
  /** Rentas finalizadas que volvieron desde `since`, con km de salida y de vuelta. */
  finishedTrips(vehicleIds: readonly string[], since: Date): Promise<FinishedTrip[]>;
}

export const FLEET_SNAPSHOT_SOURCE = Symbol('fleet-maintenance.FleetSnapshotSource');
