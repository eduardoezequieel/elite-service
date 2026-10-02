import { API_ERROR_CODES } from '@elite/shared';
import type {
  CreateFleetExpenseInput,
  FleetExpenseList,
  FleetExpenseRow,
  FleetExpensesQuery,
  UpdateFleetExpenseInput,
} from '@elite/shared';

import { slicePage } from '../../../common/pagination/page';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../common/errors/application-error';
import {
  includesAutomatic,
  isEditableExpense,
  mergeExpenses,
  sumExpenses,
} from '../domain/expenses';
import type {
  AutomaticExpenseSource,
  ExpenseFilter,
  FleetExpenseRepository,
} from './ports/fleet-expense.repository';
import type { FleetExpensesReader } from './ports/fleet-expenses-reader';
import type { FleetSnapshotSource } from './ports/fleet-snapshot.source';

/**
 * Los gastos por carro (099 RN-3, RN-4, RN-5): los anotados a mano y los que
 * llegan solos —lavados pagados del carwash con la misma placa y multas que no
 * se le cargaron al cliente—. Los automáticos son de solo lectura; un gasto
 * que sale de un servicio se corrige desde el servicio.
 *
 * Implementa el puerto exportado {@link FleetExpensesReader} que lee la
 * rentabilidad (100).
 */
export class FleetExpenseUseCases implements FleetExpensesReader {
  constructor(
    private readonly expenses: FleetExpenseRepository,
    private readonly automatic: AutomaticExpenseSource,
    private readonly fleet: FleetSnapshotSource,
  ) {}

  /**
   * Una página (101). Los tres orígenes se juntan antes de recortar —uno sale
   * de SQL crudo del carwash—, así que la página se arma en memoria y
   * `totalAmount` es la suma de todas las filas del filtro.
   */
  async list(query: FleetExpensesQuery): Promise<FleetExpenseList> {
    const { page, pageSize, ...filter } = query;
    const rows = await this.all(filter);

    return { ...slicePage(rows, { page, pageSize }), totalAmount: sumExpenses(rows) };
  }

  async listByVehicle(vehicleId: string, from?: string, to?: string): Promise<FleetExpenseRow[]> {
    return this.all({ vehicleId, from, to });
  }

  async sumByVehicle(vehicleId: string, from?: string, to?: string): Promise<string> {
    return sumExpenses(await this.all({ vehicleId, from, to }));
  }

  async create(input: CreateFleetExpenseInput, userId: string): Promise<FleetExpenseRow> {
    await this.assertVehicle(input.vehicleId);

    return this.expenses.create({ ...input, createdByUserId: userId });
  }

  async update(id: string, input: UpdateFleetExpenseInput): Promise<FleetExpenseRow> {
    await this.editable(id);
    if (input.vehicleId !== undefined) await this.assertVehicle(input.vehicleId);

    return this.expenses.update(id, input);
  }

  async remove(id: string): Promise<void> {
    await this.editable(id);
    await this.expenses.delete(id);
  }

  private async all(filter: ExpenseFilter): Promise<FleetExpenseRow[]> {
    const { type, ...range } = filter;
    const [manual, washes, fines] = await Promise.all([
      this.expenses.list(filter),
      includesAutomatic(type, 'WASH') ? this.automatic.carwashWashes(range) : [],
      includesAutomatic(type, 'FINE') ? this.automatic.unchargedFines(range) : [],
    ]);

    return mergeExpenses(manual, washes, fines);
  }

  /** RN-3: solo un gasto manual que no viene de un servicio. */
  private async editable(id: string): Promise<FleetExpenseRow> {
    const row = await this.expenses.findById(id);

    if (row === null) {
      throw new NotFoundError({ code: API_ERROR_CODES.NOT_FOUND, message: 'Ese gasto no existe.' });
    }
    if (!isEditableExpense(row)) {
      throw new ConflictError({
        code: API_ERROR_CODES.CONFLICT,
        message: 'Ese gasto sale de un servicio: se corrige desde el servicio.',
        details: { maintenanceLogId: row.maintenanceLogId },
      });
    }

    return row;
  }

  private async assertVehicle(vehicleId: string): Promise<void> {
    if ((await this.fleet.findVehicle(vehicleId)) === null) {
      throw new ValidationError({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'Ese carro no existe.',
        details: { vehicleId: 'Ese carro no existe.' },
      });
    }
  }
}
