import type {
  CreateFleetExpenseInput,
  FleetExpenseRow,
  FleetExpenseType,
  UpdateFleetExpenseInput,
} from '@elite/shared';

/** El filtro de una lista de gastos. Fechas civiles inclusive. */
export interface ExpenseFilter {
  vehicleId?: string;
  type?: FleetExpenseType;
  from?: string;
  to?: string;
}

/** Puerto de los gastos anotados (`fleet_expenses`, 099 RN-3). */
export interface FleetExpenseRepository {
  list(filter: ExpenseFilter): Promise<FleetExpenseRow[]>;
  findById(id: string): Promise<FleetExpenseRow | null>;
  create(input: CreateFleetExpenseInput & { createdByUserId: string }): Promise<FleetExpenseRow>;
  update(id: string, changes: UpdateFleetExpenseInput): Promise<FleetExpenseRow>;
  delete(id: string): Promise<void>;
}

export const FLEET_EXPENSE_REPOSITORY = Symbol('fleet-maintenance.FleetExpenseRepository');

/**
 * Los gastos que nadie anota (099 RN-4): los lavados pagados del carwash cuya
 * placa es la de un carro de la flota, y las multas que no se le cargaron al
 * cliente. Solo lectura.
 */
export interface AutomaticExpenseSource {
  carwashWashes(filter: Omit<ExpenseFilter, 'type'>): Promise<FleetExpenseRow[]>;
  unchargedFines(filter: Omit<ExpenseFilter, 'type'>): Promise<FleetExpenseRow[]>;
}

export const AUTOMATIC_EXPENSE_SOURCE = Symbol('fleet-maintenance.AutomaticExpenseSource');
