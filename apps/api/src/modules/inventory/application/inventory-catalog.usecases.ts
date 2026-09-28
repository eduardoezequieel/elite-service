import { API_ERROR_CODES } from '@elite/shared';
import type {
  CreateInventoryCategoryInput,
  CreateInventoryItemInput,
  InventoryCategoriesQuery,
  InventoryCategory,
  InventoryItem,
  InventoryItemsQuery,
  Page,
  UpdateInventoryCategoryInput,
  UpdateInventoryItemInput,
} from '@elite/shared';

import { NotFoundError, ValidationError } from '../../../common/errors/application-error';
import { fromMoneyString, toMoneyString } from '../domain/cost';
import {
  BarcodeTakenError,
  CategoryKindMismatchError,
  CategoryNameTakenError,
  type ItemKind,
  resolveItemPrice,
} from '../domain/inventory-item';
import { withInventoryErrors } from './inventory-errors';
import type {
  CategoryChanges,
  InventoryRepository,
  ItemChanges,
} from './ports/inventory.repository';

const DEFAULT_UNIT = 'unidad';
const NO_MIN_STOCK = '0.000';

function itemNotFound(): NotFoundError {
  return new NotFoundError({
    code: API_ERROR_CODES.NOT_FOUND,
    message: 'Ese artículo no existe.',
  });
}

/**
 * Categorías y artículos del inventario (065 RN-1, RN-14, RN-15, RN-16).
 *
 * La categoría tiene tipo, fijo al crearla como el del artículo, y solo agrupa
 * artículos de su tipo (072). El nombre es único dentro de cada tipo.
 *
 * El alta y la edición no tocan existencias: eso solo lo hace un movimiento
 * (`InventoryMovementUseCases`). Un artículo nace con existencia cero.
 */
export class InventoryCatalogUseCases {
  constructor(private readonly inventory: InventoryRepository) {}

  // --- categorías ---

  listCategories(query: InventoryCategoriesQuery): Promise<InventoryCategory[]> {
    return this.inventory.listCategories({
      kind: query.kind,
      includeInactive: query.includeInactive ?? false,
    });
  }

  /** @throws 409 CATEGORY_NAME_TAKEN si ya hay una del mismo tipo con ese nombre. */
  createCategory(input: CreateInventoryCategoryInput): Promise<InventoryCategory> {
    return withInventoryErrors(async () => {
      await this.assertCategoryNameFree(input.kind, input.name);

      return this.inventory.createCategory({
        kind: input.kind,
        name: input.name,
        sortOrder: input.sortOrder ?? 0,
      });
    });
  }

  /** `kind` no se acepta (072): el schema lo descarta. */
  updateCategory(id: string, input: UpdateInventoryCategoryInput): Promise<InventoryCategory> {
    return withInventoryErrors(async () => {
      const current = await this.inventory.findCategoryById(id);

      if (current === null) {
        throw new NotFoundError({
          code: API_ERROR_CODES.NOT_FOUND,
          message: 'Esa categoría no existe.',
        });
      }

      const changes: CategoryChanges = {};

      if (input.name !== undefined) {
        await this.assertCategoryNameFree(current.kind, input.name, id);
        changes.name = input.name;
      }
      if (input.sortOrder !== undefined) changes.sortOrder = input.sortOrder;
      if (input.isActive !== undefined) changes.isActive = input.isActive;

      return this.inventory.updateCategory(id, changes);
    });
  }

  // --- artículos ---

  listItems(query: InventoryItemsQuery): Promise<Page<InventoryItem>> {
    const search = query.search?.trim();

    return this.inventory.listItems({
      kind: query.kind,
      search: search === undefined || search === '' ? undefined : search,
      categoryId: query.categoryId,
      lowStock: query.lowStock ?? false,
      includeInactive: query.includeInactive ?? false,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  async findItem(id: string): Promise<InventoryItem> {
    const item = await this.inventory.findItemById(id);

    if (item === null) throw itemNotFound();

    return item;
  }

  /**
   * @throws 400 SUPPLY_HAS_PRICE si un insumo trae precio (RN-1), 409
   * BARCODE_TAKEN (RN-15), 422 si la categoría no existe, 422
   * CATEGORY_KIND_MISMATCH si es del otro tipo (072).
   */
  createItem(input: CreateInventoryItemInput): Promise<InventoryItem> {
    return withInventoryErrors(async () => {
      const price = resolveItemPrice(
        input.kind,
        input.price === undefined ? undefined : fromMoneyString(input.price),
      );

      if (input.categoryId !== undefined) {
        await this.assertCategoryFits(input.categoryId, input.kind);
      }
      if (input.barcode !== undefined) await this.assertBarcodeFree(input.barcode);

      return this.inventory.createItem({
        kind: input.kind,
        name: input.name,
        categoryId: input.categoryId ?? null,
        unit: input.unit ?? DEFAULT_UNIT,
        price: toMoneyString(price),
        minStock: input.minStock ?? NO_MIN_STOCK,
        barcode: input.barcode ?? null,
      });
    });
  }

  /**
   * `kind` no se acepta (RN-1): el schema lo descarta. El precio se valida
   * contra el tipo que ya tiene el artículo.
   */
  updateItem(id: string, input: UpdateInventoryItemInput): Promise<InventoryItem> {
    return withInventoryErrors(async () => {
      const current = await this.inventory.findItemById(id);

      if (current === null) throw itemNotFound();

      const changes: ItemChanges = {};

      if (input.name !== undefined) changes.name = input.name;
      if (input.unit !== undefined) changes.unit = input.unit;
      if (input.minStock !== undefined) changes.minStock = input.minStock;
      if (input.isActive !== undefined) changes.isActive = input.isActive;

      if (input.price !== undefined) {
        changes.price = toMoneyString(resolveItemPrice(current.kind, fromMoneyString(input.price)));
      }

      if (input.categoryId !== undefined) {
        if (input.categoryId !== null) {
          await this.assertCategoryFits(input.categoryId, current.kind);
        }
        changes.categoryId = input.categoryId;
      }

      if (input.barcode !== undefined) {
        if (input.barcode !== null) await this.assertBarcodeFree(input.barcode, id);
        changes.barcode = input.barcode;
      }

      return this.inventory.updateItem(id, changes);
    });
  }

  private async assertCategoryNameFree(
    kind: ItemKind,
    name: string,
    exceptId?: string,
  ): Promise<void> {
    const existing = await this.inventory.findCategoryByName(kind, name);

    if (existing !== null && existing.id !== exceptId) throw new CategoryNameTakenError(name);
  }

  /** Que exista y sea del tipo del artículo (072). */
  private async assertCategoryFits(categoryId: string, itemKind: ItemKind): Promise<void> {
    const category = await this.inventory.findCategoryById(categoryId);

    if (category === null) {
      throw new ValidationError({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'Esa categoría no existe.',
        details: { categoryId: 'Esa categoría no existe.' },
      });
    }

    if (category.kind !== itemKind) throw new CategoryKindMismatchError(categoryId, itemKind);
  }

  private async assertBarcodeFree(barcode: string, exceptId?: string): Promise<void> {
    const existing = await this.inventory.findItemByBarcode(barcode);

    if (existing !== null && existing.id !== exceptId) throw new BarcodeTakenError(barcode);
  }
}
