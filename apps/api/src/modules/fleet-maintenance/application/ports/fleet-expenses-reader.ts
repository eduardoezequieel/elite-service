import type { FleetExpenseRow } from '@elite/shared';

/**
 * Puerto **exportado** por `FleetMaintenanceModule` (099 RN-5): los gastos de
 * un carro con sus tres orígenes —anotados, lavados del carwash y multas no
 * cargadas—. Lo usa la rentabilidad (100) sin saber de dónde sale cada uno.
 *
 * `from` y `to` son días civiles `YYYY-MM-DD`, inclusive; sin ellos, todo.
 */
export interface FleetExpensesReader {
  listByVehicle(vehicleId: string, from?: string, to?: string): Promise<FleetExpenseRow[]>;
  /** El total, como cadena de dos decimales (`"125.50"`). */
  sumByVehicle(vehicleId: string, from?: string, to?: string): Promise<string>;
}

/** Token de inyección: `@Inject(FLEET_EXPENSES_READER) reader: FleetExpensesReader`. */
export const FLEET_EXPENSES_READER = Symbol('fleet-maintenance.FleetExpensesReader');
