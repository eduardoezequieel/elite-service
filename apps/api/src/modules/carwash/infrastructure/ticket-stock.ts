import type { InventoryLowStockPayload } from '@elite/shared';
import { WorkOrderItemKind } from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { fromQuantityString } from '../../inventory/domain/stock';
import { recordStockMovement } from '../../inventory/infrastructure/stock-ledger';
import type { StatusActor } from '../application/ports/ticket.repository';
import type { ProductQuantity, ProductStockChange } from '../domain/product-stock';

/**
 * El lado Prisma de lo que un lavado le hace al inventario (065 RN-4, RN-5).
 *
 * Todo corre con el `tx` de quien guarda el ticket: el movimiento y la linea
 * se confirman o se deshacen juntos. El unico que escribe existencias es
 * `recordStockMovement` del inventario; aca solo se le pasa que y a nombre de
 * quien.
 */

/** Bloquea el lavado y devuelve su estado. `null` si no existe. */
export async function lockWorkOrder(
  tx: Prisma.TransactionClient,
  id: string,
): Promise<string | null> {
  const rows = await tx.$queryRaw<{ status: string }[]>`
    SELECT status::text AS status FROM work_orders WHERE id = ${id}::uuid FOR UPDATE
  `;

  return rows[0]?.status ?? null;
}

/** Las lineas de producto que el lavado tiene guardadas, en milesimas. */
export async function storedProductLines(
  tx: Prisma.TransactionClient,
  workOrderId: string,
): Promise<ProductQuantity[]> {
  const rows = await tx.workOrderItem.findMany({
    where: { workOrderId, kind: WorkOrderItemKind.PRODUCT, inventoryItemId: { not: null } },
    select: { inventoryItemId: true, quantity: true },
  });

  return rows.flatMap((row) =>
    row.inventoryItemId === null
      ? []
      : [
          {
            inventoryItemId: row.inventoryItemId,
            quantity: fromQuantityString(row.quantity.toFixed(3)),
          },
        ],
  );
}

/**
 * Escribe cada movimiento en el kardex. Una venta exige articulo activo y
 * vendible; una devolucion no, porque devolver lo que ya salio siempre vale
 * (RN-14). Devuelve los avisos de minimo para publicarlos tras el commit.
 */
export async function applyProductStock(
  tx: Prisma.TransactionClient,
  workOrderId: string,
  changes: readonly ProductStockChange[],
  actor: StatusActor,
): Promise<InventoryLowStockPayload[]> {
  const lowStock: InventoryLowStockPayload[] = [];

  for (const change of changes) {
    const sale = change.type === 'SALE';
    const result = await recordStockMovement(tx, {
      itemId: change.inventoryItemId,
      type: change.type,
      quantity: change.quantity,
      workOrderId,
      createdByUserId: actor?.kind === 'user' ? actor.id : null,
      createdByEmployeeId: actor?.kind === 'employee' ? actor.id : null,
      requireActive: sale,
      requireSellable: sale,
    });

    if (result.lowStock !== null) lowStock.push(result.lowStock);
  }

  return lowStock;
}
