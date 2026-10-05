import type { InventoryLowStockPayload } from '@elite/shared';
import type { InventoryMovementType, Prisma } from '@prisma/client';

import {
  applyMovement,
  fromQuantityString,
  InventoryItemNotFoundError,
  ItemInactiveError,
  ItemNotSellableError,
  lowStockTransition,
  toQuantityString,
  type Milli,
} from '../domain/stock';

/**
 * El único camino que escribe existencias (065 RN-2, RN-3).
 *
 * Lo usan, **dentro de su propia transacción**, el inventario (entrada,
 * despacho, ajuste), el lavado (venta y devolución de productos), la venta
 * suelta y la cuenta abierta (105). Así el movimiento y lo que lo provocó se confirman o se deshacen
 * juntos. Bloquea la fila del artículo (`FOR UPDATE`) para que dos ventas
 * simultáneas no saquen la misma última unidad.
 */
export interface StockMovementInput {
  itemId: string;
  type: InventoryMovementType;
  /** Con signo, en milésimas: + entra, − sale. Nunca 0. */
  quantity: Milli;
  unitCost?: string | null;
  reference?: string | null;
  reason?: string | null;
  workOrderId?: string | null;
  counterSaleId?: string | null;
  /** La línea de cuenta abierta que sale (`SALE`) o vuelve (`SALE_RETURN`) (105). */
  tabLineId?: string | null;
  employeeId?: string | null;
  createdByUserId?: string | null;
  createdByEmployeeId?: string | null;
  /** Rechaza artículos inactivos. Una devolución (`SALE_RETURN`) no lo exige. */
  requireActive?: boolean;
  /** Rechaza insumos: solo lo que se vende (lavado, venta suelta, cuenta abierta). */
  requireSellable?: boolean;
  /** Precio de venta del movimiento, si quien llama lo trae ya resuelto. */
  unitPrice?: string | null;
  /**
   * `SALE` de una cuenta abierta (105 RN-4): guarda en `unitPrice` el precio del artículo
   * leído de la fila ya bloqueada, así ningún cambio de precio en paralelo se
   * cuela entre la lectura y el movimiento. Pisa `unitPrice`.
   */
  freezeItemPrice?: boolean;
  /** `SALE_RETURN` de una cuenta abierta: la salida que devuelve (105 RN-5). Único en la base. */
  reversesMovementId?: string | null;
  /** Promedio ponderado nuevo (RN-11), ya calculado por quien registra la entrada. */
  averageCost?: string;
}

export interface StockMovementResult {
  movementId: string;
  balanceAfter: string;
  /** Presente si este movimiento cruzó el mínimo: publicarlo tras el commit. */
  lowStock: InventoryLowStockPayload | null;
}

interface LockedItemRow {
  id: string;
  name: string;
  unit: string;
  kind: 'PRODUCT' | 'SUPPLY';
  is_active: boolean;
  price: string;
  stock_on_hand: string;
  min_stock: string;
  low_stock_notified: boolean;
}

/**
 * @throws InventoryItemNotFoundError, ItemInactiveError, ItemNotSellableError,
 * InsufficientStockError.
 */
export async function recordStockMovement(
  tx: Prisma.TransactionClient,
  input: StockMovementInput,
): Promise<StockMovementResult> {
  const rows = await tx.$queryRaw<LockedItemRow[]>`
    SELECT id, name, unit, kind::text AS kind, "isActive" AS is_active, price::text AS price,
           "stockOnHand"::text AS stock_on_hand, "minStock"::text AS min_stock,
           "lowStockNotified" AS low_stock_notified
    FROM inventory_items
    WHERE id = ${input.itemId}::uuid
    FOR UPDATE
  `;
  const item = rows[0];

  if (item === undefined) {
    throw new InventoryItemNotFoundError(input.itemId);
  }

  if (input.requireActive === true && !item.is_active) {
    throw new ItemInactiveError(input.itemId);
  }

  if (input.requireSellable === true && item.kind !== 'PRODUCT') {
    throw new ItemNotSellableError(input.itemId);
  }

  const after = applyMovement(input.itemId, fromQuantityString(item.stock_on_hand), input.quantity);
  const minStock = fromQuantityString(item.min_stock);
  const transition = lowStockTransition(after, minStock, item.low_stock_notified);
  const balanceAfter = toQuantityString(after);

  const movement = await tx.inventoryMovement.create({
    data: {
      itemId: input.itemId,
      type: input.type,
      quantity: toQuantityString(input.quantity),
      balanceAfter,
      unitCost: input.unitCost ?? null,
      unitPrice: input.freezeItemPrice === true ? item.price : (input.unitPrice ?? null),
      reversesMovementId: input.reversesMovementId ?? null,
      reference: input.reference ?? null,
      reason: input.reason ?? null,
      workOrderId: input.workOrderId ?? null,
      counterSaleId: input.counterSaleId ?? null,
      tabLineId: input.tabLineId ?? null,
      employeeId: input.employeeId ?? null,
      createdByUserId: input.createdByUserId ?? null,
      createdByEmployeeId: input.createdByEmployeeId ?? null,
    },
    select: { id: true },
  });

  await tx.inventoryItem.update({
    where: { id: input.itemId },
    data: {
      stockOnHand: balanceAfter,
      lowStockNotified: transition.notified,
      ...(input.averageCost === undefined ? {} : { averageCost: input.averageCost }),
    },
  });

  return {
    movementId: movement.id,
    balanceAfter,
    lowStock: transition.notify
      ? {
          itemId: item.id,
          name: item.name,
          stockOnHand: balanceAfter,
          minStock: toQuantityString(minStock),
          unit: item.unit,
        }
      : null,
  };
}
