import { API_ERROR_CODES } from '@elite/shared';
import type {
  CreateInventoryDeliveryInput,
  CreateInventoryEntriesInput,
  InventoryBatchResult,
} from '@elite/shared';

import { NotFoundError } from '../../../common/errors/application-error';
import type { EmployeeRepository } from '../../employees/application/ports/employee.repository';
import { fromQuantityString, ItemNotDispatchableError } from '../domain/stock';
import { toInventoryError, withInventoryErrors } from './inventory-errors';
import type { InventoryActor } from './inventory-movement.usecases';
import type { InventoryRepository, MovementData } from './ports/inventory.repository';
import { publishLowStock, type LowStockPublisher } from './ports/low-stock-events';

function blankToNull(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
}

/**
 * Entrada y entrega de varios artículos a la vez (091).
 *
 * Todas las líneas se escriben en **una** transacción (RN-2): si una falla
 * —inactiva, sin existencia, no existe— no queda ninguna, y el error nombra el
 * artículo en `details.itemId`. Los avisos de mínimo salen después del commit,
 * como en los caminos de un solo artículo (065 RN-13). Que un artículo vaya una
 * sola vez lo corta el schema del contrato (RN-3).
 */
export class InventoryBatchUseCases {
  constructor(
    private readonly inventory: InventoryRepository,
    private readonly employees: EmployeeRepository,
    private readonly events: LowStockPublisher,
  ) {}

  /**
   * Lo que llegó: una `ENTRY` por línea, con la misma referencia (la factura).
   * Cada línea con costo recalcula su promedio ponderado (065 RN-11).
   *
   * @throws 404 NOT_FOUND, 409 ITEM_INACTIVE.
   */
  recordEntries(
    input: CreateInventoryEntriesInput,
    actor: InventoryActor,
  ): Promise<InventoryBatchResult> {
    const reference = blankToNull(input.reference);

    return this.write(
      input.lines.map((line) => ({
        itemId: line.itemId,
        type: 'ENTRY',
        quantity: fromQuantityString(line.quantity),
        unitCost: line.unitCost ?? null,
        reference,
        reason: null,
        employeeId: null,
        createdByUserId: actor.userId,
        requireActive: true,
      })),
      actor,
    );
  }

  /**
   * Los insumos que se lleva un trabajador activo: un `DISPATCH` por línea
   * (065 RN-10). Un producto no se entrega: lo que alguien se lleva para pagar
   * después se anota en una cuenta abierta (105), así que la línea entera falla
   * con `ITEM_NOT_DISPATCHABLE`. El tipo no cambia nunca (065 RN-1), así que
   * leerlo antes de la transacción alcanza.
   *
   * @throws 404 EMPLOYEE_NOT_FOUND, 404 NOT_FOUND, 409 ITEM_NOT_DISPATCHABLE,
   * 409 ITEM_INACTIVE, 409 INSUFFICIENT_STOCK.
   */
  async deliver(
    input: CreateInventoryDeliveryInput,
    actor: InventoryActor,
  ): Promise<InventoryBatchResult> {
    const employee = await this.employees.findById(input.employeeId);

    if (employee === null || !employee.isActive) {
      throw new NotFoundError({
        code: API_ERROR_CODES.EMPLOYEE_NOT_FOUND,
        message: 'Ese empleado no existe o está desactivado.',
        details: { employeeId: input.employeeId },
      });
    }

    const note = blankToNull(input.note);
    const lines: MovementData[] = [];

    for (const line of input.lines) {
      const item = await this.inventory.findItemById(line.itemId);

      if (item === null) {
        throw new NotFoundError({
          code: API_ERROR_CODES.NOT_FOUND,
          message: 'Ese artículo no existe.',
          details: { itemId: line.itemId },
        });
      }

      if (item.kind !== 'SUPPLY') {
        throw toInventoryError(new ItemNotDispatchableError(item.id));
      }

      lines.push({
        itemId: item.id,
        type: 'DISPATCH',
        quantity: -fromQuantityString(line.quantity),
        unitCost: null,
        reference: null,
        reason: note,
        employeeId: employee.id,
        createdByUserId: actor.userId,
        requireActive: true,
      });
    }

    return this.write(lines, actor);
  }

  private async write(lines: MovementData[], actor: InventoryActor): Promise<InventoryBatchResult> {
    const recorded = await withInventoryErrors(() => this.inventory.recordMovements(lines));

    publishLowStock(
      this.events,
      recorded.flatMap((entry) => (entry.lowStock === null ? [] : [entry.lowStock])),
      actor.event,
    );

    return { results: recorded.map(({ item, movement }) => ({ item, movement })) };
  }
}
