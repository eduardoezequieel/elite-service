import { API_ERROR_CODES } from '@elite/shared';
import type {
  CarwashEventActor,
  CreateInventoryAdjustmentInput,
  CreateInventoryDispatchInput,
  CreateInventoryEntryInput,
  InventoryEmployeeOption,
  InventoryItemMovementsQuery,
  InventoryMovement,
  InventoryMovementResult,
  InventoryMovementsQuery,
  Page,
} from '@elite/shared';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { businessDayBounds } from '../domain/business-day';
import { fromQuantityString } from '../domain/stock';
import type { EmployeeRepository } from '../../employees/application/ports/employee.repository';
import { withInventoryErrors } from './inventory-http-errors';
import type { LowStockPublisher } from './ports/low-stock-events';
import { publishLowStock } from './ports/low-stock-events';
import type { InventoryRepository, MovementData } from './ports/inventory.repository';

/**
 * Quien registra el movimiento. Sale de la sesión que resolvió el guard, nunca
 * del cuerpo del request (RN-10).
 */
export interface InventoryActor {
  userId: string;
  /** Lo que viaja en el aviso de mínimo por el stream (042). */
  event: CarwashEventActor;
}

function blankToNull(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
}

/**
 * Entradas, despachos y ajustes desde la oficina, y el kardex (065 RN-2,
 * RN-10, RN-11, RN-12).
 *
 * Cada movimiento se confirma en su propia transacción y **después** se avisa
 * si cruzó el mínimo (RN-13): un aviso de algo que no se escribió no sale.
 */
export class InventoryMovementUseCases {
  constructor(
    private readonly inventory: InventoryRepository,
    private readonly employees: EmployeeRepository,
    private readonly events: LowStockPublisher,
  ) {}

  /**
   * A quién se le puede despachar (RN-10): empleados activos, solo id y nombre,
   * por nombre. Existe para que despachar pida `inventory.move` y no además
   * `employees.read`, que abre usuarios de pista y PINs.
   */
  async listDispatchEmployees(): Promise<InventoryEmployeeOption[]> {
    const employees = await this.employees.findAll();

    return employees
      .filter((employee) => employee.isActive)
      .map((employee) => ({ id: employee.id, fullName: employee.fullName }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
  }

  /** Entrada con costo opcional (RN-11). Un artículo inactivo no recibe: 409 ITEM_INACTIVE. */
  registerEntry(
    itemId: string,
    input: CreateInventoryEntryInput,
    actor: InventoryActor,
  ): Promise<InventoryMovementResult> {
    return this.record(
      {
        itemId,
        type: 'ENTRY',
        quantity: fromQuantityString(input.quantity),
        unitCost: input.unitCost ?? null,
        reference: blankToNull(input.reference),
        reason: null,
        employeeId: null,
        createdByUserId: actor.userId,
        requireActive: true,
      },
      actor,
    );
  }

  /**
   * Despacho a un empleado activo (RN-10). Vale para insumos y productos; el
   * tipo del artículo no cambia por eso. La nota va en `reason`.
   *
   * @throws 404 EMPLOYEE_NOT_FOUND, 409 INSUFFICIENT_STOCK, 409 ITEM_INACTIVE.
   */
  async dispatch(
    itemId: string,
    input: CreateInventoryDispatchInput,
    actor: InventoryActor,
  ): Promise<InventoryMovementResult> {
    const employee = await this.employees.findById(input.employeeId);

    if (employee === null || !employee.isActive) {
      throw new NotFoundException({
        code: API_ERROR_CODES.EMPLOYEE_NOT_FOUND,
        message: 'Ese empleado no existe o está desactivado.',
        details: { employeeId: input.employeeId },
      });
    }

    return this.record(
      {
        itemId,
        type: 'DISPATCH',
        quantity: -fromQuantityString(input.quantity),
        unitCost: null,
        reference: null,
        reason: blankToNull(input.note),
        employeeId: employee.id,
        createdByUserId: actor.userId,
        requireActive: true,
      },
      actor,
    );
  }

  /**
   * Ajuste tras un conteo físico: cantidad con signo y motivo (RN-12). Se
   * permite sobre un artículo desactivado: contar lo que quedó en la bodega de
   * algo dado de baja es justo cuando hace falta.
   *
   * @throws 409 INSUFFICIENT_STOCK si dejaría la existencia bajo cero.
   */
  adjust(
    itemId: string,
    input: CreateInventoryAdjustmentInput,
    actor: InventoryActor,
  ): Promise<InventoryMovementResult> {
    return this.record(
      {
        itemId,
        type: 'ADJUSTMENT',
        quantity: fromQuantityString(input.quantity),
        unitCost: null,
        reference: null,
        reason: input.reason,
        employeeId: null,
        createdByUserId: actor.userId,
        requireActive: false,
      },
      actor,
    );
  }

  /** El kardex de un artículo, más nuevo primero. */
  async listItemMovements(
    itemId: string,
    query: InventoryItemMovementsQuery,
  ): Promise<Page<InventoryMovement>> {
    if ((await this.inventory.findItemById(itemId)) === null) {
      throw new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese artículo no existe.',
      });
    }

    return this.inventory.listItemMovements(itemId, query.page, query.pageSize);
  }

  /**
   * El reporte plano: «quién despachó qué y a quién». Fechas civiles del
   * taller, las dos inclusive.
   */
  async listMovements(query: InventoryMovementsQuery): Promise<Page<InventoryMovement>> {
    if (query.from !== undefined && query.to !== undefined && query.from > query.to) {
      throw new UnprocessableEntityException({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'La fecha inicial no puede ser posterior a la final.',
        details: { from: 'La fecha inicial no puede ser posterior a la final.' },
      });
    }

    return this.inventory.listMovements({
      type: query.type,
      itemId: query.itemId,
      employeeId: query.employeeId,
      createdFrom: query.from === undefined ? undefined : businessDayBounds(query.from).start,
      createdBefore: query.to === undefined ? undefined : businessDayBounds(query.to).end,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  private async record(
    data: MovementData,
    actor: InventoryActor,
  ): Promise<InventoryMovementResult> {
    const recorded = await withInventoryErrors(() => this.inventory.recordMovement(data));

    publishLowStock(
      this.events,
      recorded.lowStock === null ? [] : [recorded.lowStock],
      actor.event,
    );

    return { item: recorded.item, movement: recorded.movement };
  }
}
