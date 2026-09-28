import type {
  ConsumptionEmployee,
  ConsumptionReversal,
  InventoryCategory,
  InventoryItem,
  InventoryItemKind,
  InventoryLowStockPayload,
  InventoryMovement,
  InventoryMovementActor,
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
  /** Fijo desde el alta (072). */
  kind: InventoryItemKind;
  name: string;
  sortOrder: number;
}

/** Cambios sobre una categoría. `kind` no está: se fija al crear (072). */
export interface CategoryChanges {
  name?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CategoryListFilter {
  kind?: InventoryItemKind;
  includeInactive: boolean;
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

/**
 * Un movimiento del kardex registrado desde el inventario: entrada, despacho,
 * ajuste, consumo de empleado y su anulación (070).
 */
export interface MovementData {
  itemId: string;
  type: Extract<
    InventoryMovementType,
    'ENTRY' | 'DISPATCH' | 'ADJUSTMENT' | 'CONSUMPTION' | 'CONSUMPTION_RETURN'
  >;
  /** Con signo, en milésimas. Nunca 0. */
  quantity: Milli;
  /** Solo `ENTRY`. Si viene, recalcula el promedio ponderado (RN-11). */
  unitCost: string | null;
  reference: string | null;
  reason: string | null;
  /** `DISPATCH`: quien recibió (RN-10). `CONSUMPTION*`: quien tomó (070). */
  employeeId: string | null;
  createdByUserId: string;
  /** Rechaza artículos desactivados con `ItemInactiveError` (RN-14). */
  requireActive: boolean;
  /** Rechaza insumos con `ItemNotSellableError` (070 RN-2). */
  requireSellable?: boolean;
  /**
   * `CONSUMPTION`: el repositorio copia a `unitPrice` el precio del artículo
   * leído con la fila bloqueada, dentro de la transacción (070 RN-4).
   */
  freezeItemPrice?: boolean;
  /** `CONSUMPTION_RETURN`: copia del precio del consumo que anula. */
  unitPrice?: string | null;
  /**
   * `CONSUMPTION_RETURN`: el consumo que anula (070 RN-6). Es único en la base:
   * el choque sale como `ConsumptionAlreadyReversedError`.
   */
  reversesMovementId?: string | null;
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

/** Filtro de los consumos (070): por `createdAt` del `CONSUMPTION`, `[from, before)`. */
export interface ConsumptionFilter {
  createdFrom: Date;
  createdBefore: Date;
  employeeId?: string;
}

/** Un `CONSUMPTION` con su anulación, si la tiene (070 RN-5, RN-6). */
export interface ConsumptionRecord {
  movementId: string;
  /** ISO. */
  createdAt: string;
  item: { id: string; code: string; name: string; unit: string };
  employee: ConsumptionEmployee;
  /** Positiva, tres decimales. */
  quantity: string;
  /** Dos decimales, congelado al anotar (RN-4). */
  unitPrice: string;
  createdBy: InventoryMovementActor | null;
  note: string | null;
  reversal: ConsumptionReversal | null;
}

export interface InventoryRepository {
  /** Sin `kind`, las de los dos tipos (072). */
  listCategories(filter: CategoryListFilter): Promise<InventoryCategory[]>;
  findCategoryById(id: string): Promise<InventoryCategory | null>;
  /**
   * Dentro de un tipo y sin distinguir mayúsculas: «Ceras» y «ceras» son la
   * misma categoría; «Ceras» de productos y de insumos, no (072).
   */
  findCategoryByName(kind: InventoryItemKind, name: string): Promise<InventoryCategory | null>;
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
   * @throws InventoryItemNotFoundError, ItemInactiveError, ItemNotSellableError,
   * InsufficientStockError, ConsumptionAlreadyReversedError.
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

  /** Un `CONSUMPTION` por id. `null` si no existe o es de otro tipo (070). */
  findConsumption(movementId: string): Promise<ConsumptionRecord | null>;
  /** Los `CONSUMPTION` del rango, anulados incluidos, más nuevo primero (070). */
  listConsumptions(filter: ConsumptionFilter): Promise<ConsumptionRecord[]>;
}

export const INVENTORY_REPOSITORY = Symbol('inventory.InventoryRepository');
