import type {
  InventoryCategory,
  InventoryItem,
  InventoryItemKind,
  InventoryLowStockPayload,
  InventoryMovement,
  InventoryMovementType,
  Page,
} from '@elite/shared';

import type { Milli } from '../../domain/stock';

/**
 * Puerto de persistencia del inventario (065). En producción lo implementa
 * Prisma; en los tests, `InMemoryInventoryRepository`.
 *
 * Las cantidades y el dinero viajan como cadena decimal (`"2.500"`, `"3.00"`)
 * salvo la cantidad de un movimiento, que ya va en milésimas con signo.
 */

export interface NewCategoryData {
  name: string;
  sortOrder: number;
}

export interface CategoryChanges {
  name?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface ItemListFilter {
  kind?: InventoryItemKind;
  /** Nombre, código o código de barras. */
  search?: string;
  categoryId?: string;
  /** Solo los que están en o bajo el mínimo (RN-13). */
  lowStock: boolean;
  includeInactive: boolean;
  page: number;
  pageSize: number;
}

/** Con qué nace un artículo. El código lo pone el repositorio (RN-15). */
export interface NewItemData {
  kind: InventoryItemKind;
  name: string;
  categoryId: string | null;
  unit: string;
  /** Dos decimales. `"0.00"` en un insumo (RN-1). */
  price: string;
  /** Tres decimales. */
  minStock: string;
  barcode: string | null;
}

/**
 * Cambios sobre un artículo. `kind` no está: se fija al crear (RN-1). Si cambia
 * `minStock`, el repositorio recalcula `lowStockNotified` con
 * `lowStockFlagAfterMinChange`.
 */
export interface ItemChanges {
  name?: string;
  categoryId?: string | null;
  unit?: string;
  price?: string;
  minStock?: string;
  barcode?: string | null;
  isActive?: boolean;
}

/** Un movimiento del kardex registrado desde el inventario (entrada, despacho, ajuste). */
export interface MovementData {
  itemId: string;
  type: Extract<InventoryMovementType, 'ENTRY' | 'DISPATCH' | 'ADJUSTMENT'>;
  /** Con signo, en milésimas. Nunca 0. */
  quantity: Milli;
  /** Solo `ENTRY`. Si viene, recalcula el promedio ponderado (RN-11). */
  unitCost: string | null;
  reference: string | null;
  reason: string | null;
  /** Solo `DISPATCH`: quien recibió (RN-10). */
  employeeId: string | null;
  createdByUserId: string;
  /** Rechaza artículos desactivados con `ItemInactiveError` (RN-14). */
  requireActive: boolean;
}

export interface RecordedMovement {
  item: InventoryItem;
  movement: InventoryMovement;
  /** Presente si el movimiento cruzó el mínimo: se publica tras confirmar (RN-13). */
  lowStock: InventoryLowStockPayload | null;
}

export interface MovementListFilter {
  type?: InventoryMovementType;
  itemId?: string;
  employeeId?: string;
  /** Inclusive. */
  createdFrom?: Date;
  /** Exclusivo. */
  createdBefore?: Date;
  page: number;
  pageSize: number;
}

export interface InventoryRepository {
  listCategories(includeInactive: boolean): Promise<InventoryCategory[]>;
  findCategoryById(id: string): Promise<InventoryCategory | null>;
  /** Sin distinguir mayúsculas: «Ceras» y «ceras» son la misma categoría. */
  findCategoryByName(name: string): Promise<InventoryCategory | null>;
  /** @throws CategoryNameTakenError si el nombre choca en la base. */
  createCategory(data: NewCategoryData): Promise<InventoryCategory>;
  /** @throws CategoryNameTakenError si el nombre choca en la base. */
  updateCategory(id: string, changes: CategoryChanges): Promise<InventoryCategory>;

  listItems(filter: ItemListFilter): Promise<Page<InventoryItem>>;
  findItemById(id: string): Promise<InventoryItem | null>;
  findItemByBarcode(barcode: string): Promise<InventoryItem | null>;
  /** Genera el código `INV-NNNN`. @throws BarcodeTakenError si choca en la base. */
  createItem(data: NewItemData): Promise<InventoryItem>;
  /** @throws BarcodeTakenError si choca en la base. */
  updateItem(id: string, changes: ItemChanges): Promise<InventoryItem>;

  /**
   * Escribe el movimiento y la existencia en una transacción, con la fila del
   * artículo bloqueada (RN-2, RN-3).
   *
   * @throws InventoryItemNotFoundError, ItemInactiveError, InsufficientStockError.
   */
  recordMovement(data: MovementData): Promise<RecordedMovement>;
  /** El kardex de un artículo, más nuevo primero. */
  listItemMovements(
    itemId: string,
    page: number,
    pageSize: number,
  ): Promise<Page<InventoryMovement>>;
  /** El reporte plano, más nuevo primero. */
  listMovements(filter: MovementListFilter): Promise<Page<InventoryMovement>>;
}

export const INVENTORY_REPOSITORY = Symbol('inventory.InventoryRepository');
