import { API_ERROR_CODES } from '@elite/shared';
import type {
  ConsumptionEmployee,
  ConsumptionMonthQuery,
  CreateInventoryConsumptionInput,
  EmployeeConsumptionDetail,
  EmployeeConsumptionEntry,
  EmployeeConsumptionReport,
  InventoryMovementResult,
  ReverseInventoryConsumptionInput,
} from '@elite/shared';

import { NotFoundError } from '../../../common/errors/application-error';
import type { EmployeeRepository } from '../../employees/application/ports/employee.repository';
import { businessMonthBounds, businessMonthOf } from '../domain/business-day';
import {
  ConsumptionAlreadyReversedError,
  consumptionByEmployee,
  consumptionTotals,
  consumptionValue,
  type ConsumptionFigures,
} from '../domain/consumption';
import { fromMoneyString, toMoneyString } from '../domain/cost';
import { fromQuantityString, toQuantityString } from '../domain/stock';
import { toInventoryError, withInventoryErrors } from './inventory-errors';
import type { InventoryActor } from './inventory-movement.usecases';
import type {
  ConsumptionRecord,
  InventoryRepository,
  MovementData,
} from './ports/inventory.repository';
import { publishLowStock, type LowStockPublisher } from './ports/low-stock-events';

function blankToNull(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
}

function employeeNotFound(employeeId: string): NotFoundError {
  return new NotFoundError({
    code: API_ERROR_CODES.EMPLOYEE_NOT_FOUND,
    message: 'Ese empleado no existe o está desactivado.',
    details: { employeeId },
  });
}

function figuresOf(record: ConsumptionRecord): ConsumptionFigures {
  return {
    employeeId: record.employee.id,
    employeeName: record.employee.fullName,
    quantity: fromQuantityString(record.quantity),
    unitPrice: fromMoneyString(record.unitPrice),
    reversed: record.reversal !== null,
  };
}

function toEntry(record: ConsumptionRecord): EmployeeConsumptionEntry {
  const value = consumptionValue(
    fromQuantityString(record.quantity),
    fromMoneyString(record.unitPrice),
  );

  return {
    movementId: record.movementId,
    createdAt: record.createdAt,
    item: record.item,
    quantity: record.quantity,
    unitPrice: record.unitPrice,
    total: toMoneyString(value),
    createdBy: record.createdBy,
    note: record.note,
    reversal: record.reversal,
  };
}

/**
 * Consumo de empleados (070): lo que un trabajador toma de la refrigeradora.
 * No se cobra ni toca la caja (RN-4); sale del inventario como `CONSUMPTION`
 * y se anula con un `CONSUMPTION_RETURN` (RN-6). El reporte agrupa por el mes
 * civil del consumo (RN-5).
 *
 * `clock` existe para los tests: sin mes, el reporte es el del mes en curso.
 */
export class InventoryConsumptionUseCases {
  constructor(
    private readonly inventory: InventoryRepository,
    private readonly employees: EmployeeRepository,
    private readonly events: LowStockPublisher,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /**
   * Anota que un empleado activo tomó un producto activo (RN-2, RN-3). El
   * precio lo congela el repositorio con la fila bloqueada (RN-4).
   *
   * @throws 404 EMPLOYEE_NOT_FOUND, 404 NOT_FOUND, 409 INSUFFICIENT_STOCK,
   * 409 ITEM_INACTIVE, 409 ITEM_NOT_SELLABLE.
   */
  async record(
    itemId: string,
    input: CreateInventoryConsumptionInput,
    actor: InventoryActor,
  ): Promise<InventoryMovementResult> {
    const employee = await this.employees.findById(input.employeeId);

    if (employee === null || !employee.isActive) {
      throw employeeNotFound(input.employeeId);
    }

    return this.write(
      {
        itemId,
        type: 'CONSUMPTION',
        quantity: -fromQuantityString(input.quantity),
        unitCost: null,
        reference: null,
        reason: blankToNull(input.note),
        employeeId: employee.id,
        createdByUserId: actor.userId,
        requireActive: true,
        requireSellable: true,
        freezeItemPrice: true,
      },
      actor,
    );
  }

  /**
   * Anula un consumo entero, una sola vez (RN-6). Vale aunque el artículo o el
   * empleado ya estén desactivados.
   *
   * @throws 404 NOT_FOUND si no existe o no es un `CONSUMPTION`,
   * 409 CONSUMPTION_ALREADY_REVERSED.
   */
  async reverse(
    movementId: string,
    input: ReverseInventoryConsumptionInput,
    actor: InventoryActor,
  ): Promise<InventoryMovementResult> {
    const consumption = await this.inventory.findConsumption(movementId);

    if (consumption === null) {
      throw new NotFoundError({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese consumo no existe.',
      });
    }

    // El chequeo previo; el índice único de la base cubre la carrera.
    if (consumption.reversal !== null) {
      throw toInventoryError(new ConsumptionAlreadyReversedError(consumption.movementId));
    }

    return this.write(
      {
        itemId: consumption.item.id,
        type: 'CONSUMPTION_RETURN',
        quantity: fromQuantityString(consumption.quantity),
        unitCost: null,
        unitPrice: consumption.unitPrice,
        reversesMovementId: consumption.movementId,
        reference: null,
        reason: input.reason,
        employeeId: consumption.employee.id,
        createdByUserId: actor.userId,
        requireActive: false,
      },
      actor,
    );
  }

  /** El mes por trabajador, sin los anulados, de mayor a menor valor (RN-5). */
  async report(query: ConsumptionMonthQuery): Promise<EmployeeConsumptionReport> {
    const month = query.month ?? businessMonthOf(this.clock());
    const records = await this.consumptionsOf(month);
    const summary = consumptionByEmployee(records.map(figuresOf));
    const employees = new Map<string, ConsumptionEmployee>(
      records.map((record) => [record.employee.id, record.employee]),
    );

    return {
      month,
      total: toMoneyString(summary.total),
      rows: summary.rows.flatMap((row) => {
        const employee = employees.get(row.employeeId);

        return employee === undefined
          ? []
          : [{ employee, units: toQuantityString(row.units), total: toMoneyString(row.total) }];
      }),
    };
  }

  /**
   * Los consumos de un trabajador en el mes, anulados incluidos y marcados; las
   * cifras no los cuentan. Un empleado desactivado existe: tiene detalle.
   *
   * @throws 404 EMPLOYEE_NOT_FOUND si no existe.
   */
  async detail(
    employeeId: string,
    query: ConsumptionMonthQuery,
  ): Promise<EmployeeConsumptionDetail> {
    const employee = await this.employees.findById(employeeId);

    if (employee === null) {
      throw new NotFoundError({
        code: API_ERROR_CODES.EMPLOYEE_NOT_FOUND,
        message: 'Ese empleado no existe.',
        details: { employeeId },
      });
    }

    const month = query.month ?? businessMonthOf(this.clock());
    const records = await this.consumptionsOf(month, employee.id);
    const totals = consumptionTotals(records.map(figuresOf));

    return {
      month,
      employee: { id: employee.id, fullName: employee.fullName, isActive: employee.isActive },
      units: toQuantityString(totals.units),
      total: toMoneyString(totals.total),
      entries: records.map(toEntry),
    };
  }

  private consumptionsOf(month: string, employeeId?: string): Promise<ConsumptionRecord[]> {
    const { start, end } = businessMonthBounds(month);

    return this.inventory.listConsumptions({
      createdFrom: start,
      createdBefore: end,
      ...(employeeId === undefined ? {} : { employeeId }),
    });
  }

  private async write(data: MovementData, actor: InventoryActor): Promise<InventoryMovementResult> {
    const recorded = await withInventoryErrors(() => this.inventory.recordMovement(data));

    publishLowStock(
      this.events,
      recorded.lowStock === null ? [] : [recorded.lowStock],
      actor.event,
    );

    return { item: recorded.item, movement: recorded.movement };
  }
}
