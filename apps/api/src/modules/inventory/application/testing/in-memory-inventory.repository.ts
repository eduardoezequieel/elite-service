import type {
  InventoryCategory,
  InventoryItem,
  InventoryItemKind,
  InventoryMovement,
  Page,
} from '@elite/shared';

import { fromMoneyString, toMoneyString, weightedAverageCost } from '../../domain/cost';
import {
  BarcodeTakenError,
  CategoryNameTakenError,
  isLowStock,
  lowStockFlagAfterMinChange,
} from '../../domain/inventory-item';
import { nextItemCode } from '../../domain/item-code';
import {
  applyMovement,
  fromQuantityString,
  InventoryItemNotFoundError,
  ItemInactiveError,
  lowStockTransition,
  toQuantityString,
} from '../../domain/stock';
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
} from '../ports/inventory.repository';

interface StoredItem {
  id: string;
  code: string;
  barcode: string | null;
  name: string;
  kind: InventoryItem['kind'];
  categoryId: string | null;
  unit: string;
  price: string;
  averageCost: string;
  stockOnHand: string;
  minStock: string;
  lowStockNotified: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function page<T>(rows: T[], pageNumber: number, pageSize: number): Page<T> {
  const start = (pageNumber - 1) * pageSize;

  return {
    items: rows.slice(start, start + pageSize),
    page: pageNumber,
    pageSize,
    total: rows.length,
  };
}

/**
 * Repositorio en memoria para los tests. Mismo contrato que el de Prisma y las
 * mismas reglas del dominio: la existencia sale de `applyMovement`, el aviso de
 * `lowStockTransition` y el costo de `weightedAverageCost`.
 *
 * `people` resuelve nombres (usuarios y empleados) por id, como haría el join.
 */
export class InMemoryInventoryRepository implements InventoryRepository {
  readonly categories = new Map<string, InventoryCategory>();
  readonly items = new Map<string, StoredItem>();
  readonly movements: InventoryMovement[] = [];
  private sequence = 0;
  private clock = Date.parse('2026-09-26T15:00:00.000Z');

  constructor(private readonly people: Record<string, string> = {}) {}

  // --- categorías ---

  async listCategories(filter: CategoryListFilter): Promise<Page<InventoryCategory>> {
    const rows = [...this.categories.values()]
      .filter((category) => filter.kind === undefined || category.kind === filter.kind)
      .filter((category) => filter.active === undefined || category.isActive === filter.active)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

    return page(rows, filter.page, filter.pageSize);
  }

  async findCategoryById(id: string): Promise<InventoryCategory | null> {
    return this.categories.get(id) ?? null;
  }

  async findCategoryByName(
    kind: InventoryItemKind,
    name: string,
  ): Promise<InventoryCategory | null> {
    const wanted = name.toLowerCase();

    return (
      [...this.categories.values()].find(
        (category) => category.kind === kind && category.name.toLowerCase() === wanted,
      ) ?? null
    );
  }

  /** Como el `@@unique([kind, name])` de la base (072). */
  async createCategory(data: NewCategoryData): Promise<InventoryCategory> {
    if (
      [...this.categories.values()].some(
        (category) => category.kind === data.kind && category.name === data.name,
      )
    ) {
      throw new CategoryNameTakenError(data.name);
    }

    const category: InventoryCategory = {
      id: this.nextId('category'),
      kind: data.kind,
      name: data.name,
      sortOrder: data.sortOrder,
      isActive: true,
    };

    this.categories.set(category.id, category);

    return category;
  }

  async updateCategory(id: string, changes: CategoryChanges): Promise<InventoryCategory> {
    const current = this.categories.get(id);

    if (current === undefined) throw new Error(`category ${id} not found`);

    const updated = { ...current, ...changes };

    this.categories.set(id, updated);

    return updated;
  }

  // --- artículos ---

  async listItems(filter: ItemListFilter): Promise<Page<InventoryItem>> {
    const search = filter.search?.toLowerCase();
    const rows = [...this.items.values()]
      .filter((item) => filter.includeInactive || item.isActive)
      .filter((item) => filter.kind === undefined || item.kind === filter.kind)
      .filter((item) => filter.categoryId === undefined || item.categoryId === filter.categoryId)
      .filter(
        (item) =>
          !filter.lowStock ||
          isLowStock(fromQuantityString(item.stockOnHand), fromQuantityString(item.minStock)),
      )
      .filter(
        (item) =>
          search === undefined ||
          item.name.toLowerCase().includes(search) ||
          item.code.toLowerCase().includes(search) ||
          (item.barcode ?? '').toLowerCase().includes(search),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => this.toItem(item));

    return page(rows, filter.page, filter.pageSize);
  }

  async findItemById(id: string): Promise<InventoryItem | null> {
    const item = this.items.get(id);

    return item === undefined ? null : this.toItem(item);
  }

  async findItemByBarcode(barcode: string): Promise<InventoryItem | null> {
    const item = [...this.items.values()].find((row) => row.barcode === barcode);

    return item === undefined ? null : this.toItem(item);
  }

  async createItem(data: NewItemData): Promise<InventoryItem> {
    this.assertBarcodeFree(data.barcode, null);

    const now = this.tick();
    const item: StoredItem = {
      id: this.nextId('item'),
      code: nextItemCode([...this.items.values()].map((row) => row.code)),
      barcode: data.barcode,
      name: data.name,
      kind: data.kind,
      categoryId: data.categoryId,
      unit: data.unit,
      price: data.price,
      averageCost: '0.00',
      stockOnHand: '0.000',
      minStock: data.minStock,
      lowStockNotified: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    this.items.set(item.id, item);

    return this.toItem(item);
  }

  async updateItem(id: string, changes: ItemChanges): Promise<InventoryItem> {
    const current = this.items.get(id);

    if (current === undefined) throw new InventoryItemNotFoundError(id);
    if (changes.barcode !== undefined) this.assertBarcodeFree(changes.barcode, id);

    const updated: StoredItem = { ...current, ...changes, updatedAt: this.tick() };

    if (changes.minStock !== undefined) {
      updated.lowStockNotified = lowStockFlagAfterMinChange(
        fromQuantityString(updated.stockOnHand),
        fromQuantityString(updated.minStock),
        current.lowStockNotified,
      );
    }

    this.items.set(id, updated);

    return this.toItem(updated);
  }

  // --- movimientos ---

  async recordMovement(data: MovementData): Promise<RecordedMovement> {
    const item = this.items.get(data.itemId);

    if (item === undefined) throw new InventoryItemNotFoundError(data.itemId);
    if (data.requireActive && !item.isActive) throw new ItemInactiveError(data.itemId);

    const onHand = fromQuantityString(item.stockOnHand);
    const after = applyMovement(item.id, onHand, data.quantity);
    const minStock = fromQuantityString(item.minStock);
    const transition = lowStockTransition(after, minStock, item.lowStockNotified);

    if (data.type === 'ENTRY' && data.unitCost !== null) {
      item.averageCost = toMoneyString(
        weightedAverageCost(
          onHand,
          fromMoneyString(item.averageCost),
          data.quantity,
          fromMoneyString(data.unitCost),
        ),
      );
    }

    item.stockOnHand = toQuantityString(after);
    item.lowStockNotified = transition.notified;
    item.updatedAt = this.tick();

    const movement: InventoryMovement = {
      id: this.nextId('movement'),
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      itemUnit: item.unit,
      type: data.type,
      quantity: toQuantityString(data.quantity),
      balanceAfter: item.stockOnHand,
      unitCost: data.unitCost,
      reference: data.reference,
      reason: data.reason,
      workOrderId: null,
      ticketNumber: null,
      counterSaleId: null,
      saleNumber: null,
      tabId: null,
      tabNumber: null,
      tabHolderName: null,
      employee:
        data.employeeId === null
          ? null
          : { id: data.employeeId, fullName: this.people[data.employeeId] ?? data.employeeId },
      unitPrice: null,
      reversesMovementId: null,
      createdBy: {
        kind: 'user',
        id: data.createdByUserId,
        fullName: this.people[data.createdByUserId] ?? data.createdByUserId,
      },
      createdAt: this.tick().toISOString(),
    };

    this.movements.push(movement);

    return {
      item: this.toItem(item),
      movement,
      lowStock: transition.notify
        ? {
            itemId: item.id,
            name: item.name,
            stockOnHand: item.stockOnHand,
            minStock: item.minStock,
            unit: item.unit,
          }
        : null,
    };
  }

  /**
   * Como la transacción de la base (091 RN-2): si una línea falla, la
   * existencia y el kardex vuelven a como estaban antes de la primera.
   */
  async recordMovements(data: readonly MovementData[]): Promise<RecordedMovement[]> {
    const items = new Map([...this.items].map(([id, item]) => [id, { ...item }]));
    const movements = this.movements.length;
    const recorded: RecordedMovement[] = [];

    try {
      for (const line of data) recorded.push(await this.recordMovement(line));
    } catch (error) {
      this.items.clear();
      for (const [id, item] of items) this.items.set(id, item);
      this.movements.splice(movements);
      throw error;
    }

    return recorded;
  }

  async listItemMovements(
    itemId: string,
    pageNumber: number,
    pageSize: number,
  ): Promise<Page<InventoryMovement>> {
    return page(
      this.newestFirst().filter((movement) => movement.itemId === itemId),
      pageNumber,
      pageSize,
    );
  }

  async listMovements(filter: MovementListFilter): Promise<Page<InventoryMovement>> {
    const rows = this.newestFirst()
      .filter((movement) => filter.type === undefined || filter.type.includes(movement.type))
      .filter((movement) => filter.itemId === undefined || movement.itemId === filter.itemId)
      .filter(
        (movement) =>
          filter.employeeId === undefined || movement.employee?.id === filter.employeeId,
      )
      .filter(
        (movement) =>
          filter.createdFrom === undefined ||
          Date.parse(movement.createdAt) >= filter.createdFrom.getTime(),
      )
      .filter(
        (movement) =>
          filter.createdBefore === undefined ||
          Date.parse(movement.createdAt) < filter.createdBefore.getTime(),
      );

    return page(rows, filter.page, filter.pageSize);
  }

  /** Fija la hora de los próximos registros (para probar el filtro de fechas). */
  setClock(iso: string): void {
    this.clock = Date.parse(iso);
  }

  private newestFirst(): InventoryMovement[] {
    return [...this.movements].reverse();
  }

  private assertBarcodeFree(barcode: string | null, exceptId: string | null): void {
    if (barcode === null) return;

    const taken = [...this.items.values()].some(
      (item) => item.barcode === barcode && item.id !== exceptId,
    );

    if (taken) throw new BarcodeTakenError(barcode);
  }

  private toItem(item: StoredItem): InventoryItem {
    const category = item.categoryId === null ? undefined : this.categories.get(item.categoryId);

    return {
      id: item.id,
      code: item.code,
      barcode: item.barcode,
      name: item.name,
      kind: item.kind,
      category: category === undefined ? null : { id: category.id, name: category.name },
      unit: item.unit,
      price: item.price,
      taxRate: '0.1300',
      averageCost: item.averageCost,
      stockOnHand: item.stockOnHand,
      minStock: item.minStock,
      isLowStock: isLowStock(
        fromQuantityString(item.stockOnHand),
        fromQuantityString(item.minStock),
      ),
      isActive: item.isActive,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private nextId(prefix: string): string {
    this.sequence += 1;

    return `${prefix}-${this.sequence}`;
  }

  private tick(): Date {
    this.clock += 1000;

    return new Date(this.clock);
  }
}
