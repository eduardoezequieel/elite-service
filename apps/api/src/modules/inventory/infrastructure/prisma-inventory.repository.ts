import type {
  InventoryCategory,
  InventoryItem,
  InventoryItemKind,
  InventoryMovement,
  Page,
} from '@elite/shared';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { lastSequence, SEQUENCE_ATTEMPTS } from '../../../common/prisma/last-sequence';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { uniqueViolationOn } from '../../../common/prisma/unique-violation';
import { decimalToMilli } from '../../../common/prisma/decimal';
import { fromMoneyString, toMoneyString, weightedAverageCost } from '../domain/cost';
import {
  BarcodeTakenError,
  CategoryNameTakenError,
  isLowStock,
  lowStockFlagAfterMinChange,
} from '../domain/inventory-item';
import { ITEM_CODE_PREFIX, nextItemCode } from '../domain/item-code';
import { fromQuantityString, InventoryItemNotFoundError } from '../domain/stock';
import type {
  CategoryChanges,
  CategoryListFilter,
  InventoryRepository,
  ItemChanges,
  ItemListFilter,
  MovementData,
  MovementListFilter,
  NewCategoryData,
  NewItemData,
  RecordedMovement,
} from '../application/ports/inventory.repository';
import { recordStockMovement, type StockMovementResult } from './stock-ledger';

const ITEM_INCLUDE = {
  category: { select: { id: true, name: true } },
} satisfies Prisma.InventoryItemInclude;

type ItemRow = Prisma.InventoryItemGetPayload<{ include: typeof ITEM_INCLUDE }>;

const MOVEMENT_INCLUDE = {
  item: { select: { code: true, name: true, unit: true } },
  workOrder: { select: { number: true } },
  counterSale: { select: { number: true } },
  // La cuenta abierta de la línea y su titular (105): «Venta C-0012», «A quién».
  tabLine: {
    select: {
      tab: {
        select: {
          id: true,
          number: true,
          employee: { select: { fullName: true } },
          customer: { select: { fullName: true } },
        },
      },
    },
  },
  employee: { select: { id: true, fullName: true } },
  createdByUser: { select: { id: true, fullName: true } },
  createdByEmployee: { select: { id: true, fullName: true } },
} satisfies Prisma.InventoryMovementInclude;

type MovementRow = Prisma.InventoryMovementGetPayload<{ include: typeof MOVEMENT_INCLUDE }>;

const NEWEST_FIRST = [
  { createdAt: 'desc' },
  { id: 'desc' },
] satisfies Prisma.InventoryMovementOrderByWithRelationInput[];

interface LockedCostRow {
  stock_on_hand: string;
  average_cost: string;
}

function toCategory(row: {
  id: string;
  kind: InventoryCategory['kind'];
  name: string;
  sortOrder: number;
  isActive: boolean;
}): InventoryCategory {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

function toItem(row: ItemRow): InventoryItem {
  const stockOnHand = row.stockOnHand.toFixed(3);
  const minStock = row.minStock.toFixed(3);

  return {
    id: row.id,
    code: row.code,
    barcode: row.barcode,
    name: row.name,
    kind: row.kind,
    category: row.category === null ? null : { id: row.category.id, name: row.category.name },
    unit: row.unit,
    price: row.price.toFixed(2),
    taxRate: row.taxRate.toFixed(4),
    averageCost: row.averageCost.toFixed(2),
    stockOnHand,
    minStock,
    isLowStock: isLowStock(fromQuantityString(stockOnHand), fromQuantityString(minStock)),
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function actorOf(
  row: Pick<MovementRow, 'createdByUser' | 'createdByEmployee'>,
): InventoryMovement['createdBy'] {
  return row.createdByUser !== null
    ? { kind: 'user', id: row.createdByUser.id, fullName: row.createdByUser.fullName }
    : row.createdByEmployee !== null
      ? {
          kind: 'employee',
          id: row.createdByEmployee.id,
          fullName: row.createdByEmployee.fullName,
        }
      : null;
}

function toMovement(row: MovementRow): InventoryMovement {
  const createdBy = actorOf(row);
  const tab = row.tabLine?.tab ?? null;

  return {
    id: row.id,
    itemId: row.itemId,
    itemCode: row.item.code,
    itemName: row.item.name,
    itemUnit: row.item.unit,
    type: row.type,
    quantity: row.quantity.toFixed(3),
    balanceAfter: row.balanceAfter.toFixed(3),
    unitCost: row.unitCost === null ? null : row.unitCost.toFixed(2),
    reference: row.reference,
    reason: row.reason,
    workOrderId: row.workOrderId,
    ticketNumber: row.workOrder?.number ?? null,
    counterSaleId: row.counterSaleId,
    saleNumber: row.counterSale?.number ?? null,
    tabId: tab?.id ?? null,
    tabNumber: tab?.number ?? null,
    tabHolderName: tab === null ? null : (tab.employee?.fullName ?? tab.customer?.fullName ?? null),
    employee:
      row.employee === null ? null : { id: row.employee.id, fullName: row.employee.fullName },
    unitPrice: row.unitPrice === null ? null : row.unitPrice.toFixed(2),
    reversesMovementId: row.reversesMovementId,
    createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class PrismaInventoryRepository implements InventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --- categorías ---

  async listCategories(filter: CategoryListFilter): Promise<Page<InventoryCategory>> {
    const where: Prisma.InventoryCategoryWhereInput = {
      ...(filter.kind === undefined ? {} : { kind: filter.kind }),
      ...(filter.active === undefined ? {} : { isActive: filter.active }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.inventoryCategory.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.inventoryCategory.count({ where }),
    ]);

    return { items: rows.map(toCategory), page: filter.page, pageSize: filter.pageSize, total };
  }

  async findCategoryById(id: string): Promise<InventoryCategory | null> {
    const row = await this.prisma.inventoryCategory.findUnique({ where: { id } });

    return row === null ? null : toCategory(row);
  }

  async findCategoryByName(
    kind: InventoryItemKind,
    name: string,
  ): Promise<InventoryCategory | null> {
    const row = await this.prisma.inventoryCategory.findFirst({
      where: { kind, name: { equals: name, mode: 'insensitive' } },
    });

    return row === null ? null : toCategory(row);
  }

  async createCategory(data: NewCategoryData): Promise<InventoryCategory> {
    try {
      return toCategory(
        await this.prisma.inventoryCategory.create({
          data: { kind: data.kind, name: data.name, sortOrder: data.sortOrder },
        }),
      );
    } catch (error) {
      if (uniqueViolationOn(error, 'name')) throw new CategoryNameTakenError(data.name);
      throw error;
    }
  }

  async updateCategory(id: string, changes: CategoryChanges): Promise<InventoryCategory> {
    try {
      return toCategory(
        await this.prisma.inventoryCategory.update({ where: { id }, data: changes }),
      );
    } catch (error) {
      if (uniqueViolationOn(error, 'name')) throw new CategoryNameTakenError(changes.name ?? '');
      throw error;
    }
  }

  // --- artículos ---

  async listItems(filter: ItemListFilter): Promise<Page<InventoryItem>> {
    const where: Prisma.InventoryItemWhereInput = {
      ...(filter.includeInactive ? {} : { isActive: true }),
      ...(filter.kind === undefined ? {} : { kind: filter.kind }),
      ...(filter.categoryId === undefined ? {} : { categoryId: filter.categoryId }),
      ...(filter.lowStock
        ? {
            minStock: { gt: 0 },
            stockOnHand: { lte: this.prisma.inventoryItem.fields.minStock },
          }
        : {}),
      ...(filter.search === undefined
        ? {}
        : {
            OR: [
              { name: { contains: filter.search, mode: 'insensitive' } },
              { code: { contains: filter.search, mode: 'insensitive' } },
              { barcode: { contains: filter.search, mode: 'insensitive' } },
            ],
          }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.inventoryItem.findMany({
        where,
        include: ITEM_INCLUDE,
        orderBy: [{ name: 'asc' }, { code: 'asc' }],
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.inventoryItem.count({ where }),
    ]);

    return { items: rows.map(toItem), page: filter.page, pageSize: filter.pageSize, total };
  }

  async findItemById(id: string): Promise<InventoryItem | null> {
    const row = await this.prisma.inventoryItem.findUnique({
      where: { id },
      include: ITEM_INCLUDE,
    });

    return row === null ? null : toItem(row);
  }

  async findItemByBarcode(barcode: string): Promise<InventoryItem | null> {
    const row = await this.prisma.inventoryItem.findUnique({
      where: { barcode },
      include: ITEM_INCLUDE,
    });

    return row === null ? null : toItem(row);
  }

  /**
   * El código se lee y se inserta en la misma transacción; `code` es único, así
   * que dos altas simultáneas chocan ahí y la segunda reintenta con el siguiente
   * (RN-15).
   */
  async createItem(data: NewItemData): Promise<InventoryItem> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        const row = await this.prisma.$transaction(async (tx) => {
          // Por largo y después por texto: `INV-10000` va después de `INV-9999`.
          const last = await lastSequence(tx, 'inventory_items', ITEM_CODE_PREFIX);

          return tx.inventoryItem.create({
            data: {
              code: nextItemCode(last === null ? [] : [last]),
              kind: data.kind,
              name: data.name,
              categoryId: data.categoryId,
              unit: data.unit,
              price: data.price,
              minStock: data.minStock,
              barcode: data.barcode,
            },
            include: ITEM_INCLUDE,
          });
        });

        return toItem(row);
      } catch (error) {
        if (data.barcode !== null && uniqueViolationOn(error, 'barcode')) {
          throw new BarcodeTakenError(data.barcode);
        }
        if (attempt < SEQUENCE_ATTEMPTS && uniqueViolationOn(error, 'code')) continue;
        throw error;
      }
    }
  }

  async updateItem(id: string, changes: ItemChanges): Promise<InventoryItem> {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const current = await tx.inventoryItem.findUnique({
          where: { id },
          select: { stockOnHand: true, lowStockNotified: true },
        });

        if (current === null) throw new InventoryItemNotFoundError(id);

        return tx.inventoryItem.update({
          where: { id },
          data: {
            ...changes,
            ...(changes.minStock === undefined
              ? {}
              : {
                  lowStockNotified: lowStockFlagAfterMinChange(
                    decimalToMilli(current.stockOnHand),
                    fromQuantityString(changes.minStock),
                    current.lowStockNotified,
                  ),
                }),
          },
          include: ITEM_INCLUDE,
        });
      });

      return toItem(row);
    } catch (error) {
      if (
        changes.barcode !== undefined &&
        changes.barcode !== null &&
        uniqueViolationOn(error, 'barcode')
      ) {
        throw new BarcodeTakenError(changes.barcode);
      }
      throw error;
    }
  }

  // --- movimientos ---

  /**
   * El movimiento pasa por `recordStockMovement`, el único camino que escribe
   * existencias. Una entrada con costo bloquea antes la fila para leer la
   * existencia y el promedio con los que pondera (RN-11): leídos fuera de la
   * transacción, una venta en paralelo los dejaría viejos.
   */
  async recordMovement(data: MovementData): Promise<RecordedMovement> {
    const [recorded] = await this.recordMovements([data]);

    return recorded;
  }

  /**
   * Una transacción para todas las líneas (091 RN-2). Las filas se bloquean en
   * orden de id, no en el pedido: dos entregas en paralelo con los mismos
   * artículos se esperan en vez de trabarse. La respuesta vuelve en el orden
   * pedido.
   */
  async recordMovements(data: readonly MovementData[]): Promise<RecordedMovement[]> {
    const written = await this.writeMovements(data);

    return Promise.all(
      data.map(async (line, index) => {
        const recorded = written[index];
        const [item, movement] = await Promise.all([
          this.prisma.inventoryItem.findUniqueOrThrow({
            where: { id: line.itemId },
            include: ITEM_INCLUDE,
          }),
          this.prisma.inventoryMovement.findUniqueOrThrow({
            where: { id: recorded.movementId },
            include: MOVEMENT_INCLUDE,
          }),
        ]);

        return { item: toItem(item), movement: toMovement(movement), lowStock: recorded.lowStock };
      }),
    );
  }

  /**
   * La transacción de `recordMovements`, en orden de artículo para que dos lotes
   * simultáneos bloqueen las filas en el mismo orden.
   */
  private async writeMovements(data: readonly MovementData[]): Promise<StockMovementResult[]> {
    const order = data
      .map((line, index) => ({ line, index }))
      .sort((a, b) => a.line.itemId.localeCompare(b.line.itemId));

    return this.prisma.$transaction(async (tx) => {
      const results: StockMovementResult[] = new Array<StockMovementResult>(data.length);

      for (const { line, index } of order) {
        results[index] = await this.writeMovement(tx, line);
      }

      return results;
    });
  }

  private async writeMovement(
    tx: Prisma.TransactionClient,
    data: MovementData,
  ): Promise<StockMovementResult> {
    let averageCost: string | undefined;

    if (data.type === 'ENTRY' && data.unitCost !== null) {
      const rows = await tx.$queryRaw<LockedCostRow[]>`
        SELECT "stockOnHand"::text AS stock_on_hand, "averageCost"::text AS average_cost
        FROM inventory_items
        WHERE id = ${data.itemId}::uuid
        FOR UPDATE
      `;
      const locked = rows[0];

      if (locked === undefined) throw new InventoryItemNotFoundError(data.itemId);

      averageCost = toMoneyString(
        weightedAverageCost(
          fromQuantityString(locked.stock_on_hand),
          fromMoneyString(locked.average_cost),
          data.quantity,
          fromMoneyString(data.unitCost),
        ),
      );
    }

    return recordStockMovement(tx, {
      itemId: data.itemId,
      type: data.type,
      quantity: data.quantity,
      unitCost: data.unitCost,
      reference: data.reference,
      reason: data.reason,
      employeeId: data.employeeId,
      createdByUserId: data.createdByUserId,
      requireActive: data.requireActive,
      averageCost,
    });
  }

  async listItemMovements(
    itemId: string,
    page: number,
    pageSize: number,
  ): Promise<Page<InventoryMovement>> {
    return this.pageOfMovements({ itemId }, page, pageSize);
  }

  async listMovements(filter: MovementListFilter): Promise<Page<InventoryMovement>> {
    const createdAt: Prisma.DateTimeFilter = {
      ...(filter.createdFrom === undefined ? {} : { gte: filter.createdFrom }),
      ...(filter.createdBefore === undefined ? {} : { lt: filter.createdBefore }),
    };

    return this.pageOfMovements(
      {
        ...(filter.type === undefined ? {} : { type: { in: [...filter.type] } }),
        ...(filter.itemId === undefined ? {} : { itemId: filter.itemId }),
        ...(filter.employeeId === undefined ? {} : { employeeId: filter.employeeId }),
        ...(Object.keys(createdAt).length === 0 ? {} : { createdAt }),
      },
      filter.page,
      filter.pageSize,
    );
  }

  private async pageOfMovements(
    where: Prisma.InventoryMovementWhereInput,
    page: number,
    pageSize: number,
  ): Promise<Page<InventoryMovement>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.findMany({
        where,
        include: MOVEMENT_INCLUDE,
        orderBy: NEWEST_FIRST,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);

    return { items: rows.map(toMovement), page, pageSize, total };
  }
}
