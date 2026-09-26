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
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { fromMoneyString, toMoneyString } from '../domain/cost';
import {
  BarcodeTakenError,
  CategoryNameTakenError,
  resolveItemPrice,
} from '../domain/inventory-item';
import { withInventoryErrors } from './inventory-http-errors';
import type {
  CategoryChanges,
  InventoryRepository,
  ItemChanges,
} from './ports/inventory.repository';

const DEFAULT_UNIT = 'unidad';
const NO_MIN_STOCK = '0.000';

function itemNotFound(): NotFoundException {
  return new NotFoundException({
    code: API_ERROR_CODES.NOT_FOUND,
    message: 'Ese artículo no existe.',
  });
}

/**
 * Categorías y artículos del inventario (065 RN-1, RN-14, RN-15, RN-16).
 *
 * El alta y la edición no tocan existencias: eso solo lo hace un movimiento
 * (`InventoryMovementUseCases`). Un artículo nace con existencia cero.
 */
export class InventoryCatalogUseCases {
  constructor(private readonly inventory: InventoryRepository) {}

  // --- categorías ---

  listCategories(query: InventoryCategoriesQuery): Promise<InventoryCategory[]> {
    return this.inventory.listCategories(query.includeInactive ?? false);
  }

  createCategory(input: CreateInventoryCategoryInput): Promise<InventoryCategory> {
    return withInventoryErrors(async () => {
      await this.assertCategoryNameFree(input.name);

      return this.inventory.createCategory({ name: input.name, sortOrder: input.sortOrder ?? 0 });
    });
  }

  updateCategory(id: string, input: UpdateInventoryCategoryInput): Promise<InventoryCategory> {
    return withInventoryErrors(async () => {
      if ((await this.inventory.findCategoryById(id)) === null) {
        throw new NotFoundException({
          code: API_ERROR_CODES.NOT_FOUND,
          message: 'Esa categoría no existe.',
        });
      }

      const changes: CategoryChanges = {};

      if (input.name !== undefined) {
        await this.assertCategoryNameFree(input.name, id);
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
   * BARCODE_TAKEN (RN-15), 422 si la categoría no existe.
   */
  createItem(input: CreateInventoryItemInput): Promise<InventoryItem> {
    return withInventoryErrors(async () => {
      const price = resolveItemPrice(
        input.kind,
        input.price === undefined ? undefined : fromMoneyString(input.price),
      );

      if (input.categoryId !== undefined) await this.assertCategoryExists(input.categoryId);
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
        if (input.categoryId !== null) await this.assertCategoryExists(input.categoryId);
        changes.categoryId = input.categoryId;
      }

      if (input.barcode !== undefined) {
        if (input.barcode !== null) await this.assertBarcodeFree(input.barcode, id);
        changes.barcode = input.barcode;
      }

      return this.inventory.updateItem(id, changes);
    });
  }

  private async assertCategoryNameFree(name: string, exceptId?: string): Promise<void> {
    const existing = await this.inventory.findCategoryByName(name);

    if (existing !== null && existing.id !== exceptId) throw new CategoryNameTakenError(name);
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    if ((await this.inventory.findCategoryById(categoryId)) === null) {
      throw new UnprocessableEntityException({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'Esa categoría no existe.',
        details: { categoryId: 'Esa categoría no existe.' },
      });
    }
  }

  private async assertBarcodeFree(barcode: string, exceptId?: string): Promise<void> {
    const existing = await this.inventory.findItemByBarcode(barcode);

    if (existing !== null && existing.id !== exceptId) throw new BarcodeTakenError(barcode);
  }
}
