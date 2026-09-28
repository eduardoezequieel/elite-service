import { API_ERROR_CODES } from '@elite/shared';
import type {
  ConsumptionEmployee,
  ConsumptionRangeQuery,
  CreateInventoryConsumptionInput,
  EmployeeConsumptionDetail,
  EmployeeConsumptionEntry,
  EmployeeConsumptionReport,
  InventoryMovementResult,
  ReverseInventoryConsumptionInput,
} from '@elite/shared';

import { NotFoundError, ValidationError } from '../../../common/errors/application-error';
import type { EmployeeRepository } from '../../employees/application/ports/employee.repository';
import { businessDayBounds, defaultBusinessRange } from '../domain/business-day';
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
 * y se anula con un `CONSUMPTION_RETURN` (RN-6). El reporte cuenta por la fecha
 * civil del consumo, en un rango inclusive (091 RN-4).
 *
 * `clock` existe para los tests: sin rango, el mes en curso hasta hoy.
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

  /** El rango por trabajador, sin los anulados, de mayor a menor valor (091 RN-4). */
  async report(query: ConsumptionRangeQuery): Promise<EmployeeConsumptionReport> {
    const range = this.rangeOf(query);
    const records = await this.consumptionsOf(range);
    const summary = consumptionByEmployee(records.map(figuresOf));
    const employees = new Map<string, ConsumptionEmployee>(
      records.map((record) => [record.employee.id, record.employee]),
    );

    return {
      ...range,
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
   * Los consumos de un trabajador en el rango, anulados incluidos y marcados; las
   * cifras no los cuentan. Un empleado desactivado existe: tiene detalle.
   *
   * @throws 404 EMPLOYEE_NOT_FOUND si no existe, 422 VALIDATION_ERROR si `from > to`.
   */
  async detail(
    employeeId: string,
    query: ConsumptionRangeQuery,
  ): Promise<EmployeeConsumptionDetail> {
    const range = this.rangeOf(query);
    const employee = await this.employees.findById(employeeId);

    if (employee === null) {
      throw new NotFoundError({
        code: API_ERROR_CODES.EMPLOYEE_NOT_FOUND,
        message: 'Ese empleado no existe.',
        details: { employeeId },
      });
    }

    const records = await this.consumptionsOf(range, employee.id);
    const totals = consumptionTotals(records.map(figuresOf));

    return {
      ...range,
      employee: { id: employee.id, fullName: employee.fullName, isActive: employee.isActive },
      units: toQuantityString(totals.units),
      total: toMoneyString(totals.total),
      entries: records.map(toEntry),
    };
  }

  /** Lo que no viene, del mes en curso; `from > to` no es un rango (091 RN-4). */
  private rangeOf(query: ConsumptionRangeQuery): { from: string; to: string } {
    const range = defaultBusinessRange(this.clock(), query);

    if (range.from > range.to) {
      throw new ValidationError({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'La fecha inicial no puede ser posterior a la final.',
        details: { from: 'La fecha inicial no puede ser posterior a la final.' },
      });
    }

    return range;
  }

  private consumptionsOf(
    range: { from: string; to: string },
    employeeId?: string,
  ): Promise<ConsumptionRecord[]> {
    return this.inventory.listConsumptions({
      createdFrom: businessDayBounds(range.from).start,
      createdBefore: businessDayBounds(range.to).end,
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
