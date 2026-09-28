import type {
  Customer,
  FloorEmployeeOption,
  InventoryItemOption,
  InventoryLowStockPayload,
  Ticket,
  TicketItem,
  VehicleWithOwner,
} from '@elite/shared';

import { InMemoryCustomerRepository } from '../../../customers/application/testing/in-memory-customer.repository';
import type {
  LowStockDraft,
  LowStockPublisher,
} from '../../../inventory/application/ports/low-stock-events';
import {
  applyMovement,
  InventoryItemNotFoundError,
  ItemInactiveError,
  ItemNotSellableError,
  lowStockTransition,
  toQuantityString,
  type Milli,
} from '../../../inventory/domain/stock';
import type {
  CommissionEntryRecord,
  CommissionWashRecord,
  UnassignedCommissionRecord,
} from '../../domain/commission';
import { toDecimalString } from '../../domain/money';
import { lineTotal, totalOf } from '../../domain/pricing';
import {
  productReturnsOnVoid,
  productStockChanges,
  type ProductQuantity,
  type ProductStockChange,
} from '../../domain/product-stock';
import type { StatusEventRecord } from '../../domain/ticket-timeline';
import type { InventoryCatalog, InventoryProductRecord } from '../ports/inventory-catalog';
import { canEditWashers, isOperationalStatus } from '../../domain/work-order';
import {
  TicketNotEditableError,
  TicketStatusChangedError,
  VehicleBusyError,
  type NewTicketData,
  type PriceAuthorizationData,
  type StatusActor,
  type StatusMove,
  type TicketChanges,
  type TicketItemData,
  type TicketRepository,
  type TicketWrite,
} from '../ports/ticket.repository';

/** Un articulo del inventario en memoria, con su existencia. */
export interface StockItem extends InventoryProductRecord {
  unit: string;
  onHand: Milli;
  minStock: Milli;
  notified: boolean;
}

/** Un movimiento que el kardex en memoria dejo escrito. */
export interface RecordedMovement {
  itemId: string;
  type: 'SALE' | 'SALE_RETURN';
  quantity: Milli;
  balanceAfter: Milli;
  /** `null` en la salida de una venta suelta (066): esa lleva `counterSaleId`. */
  workOrderId: string | null;
  counterSaleId?: string;
  createdByUserId: string | null;
  createdByEmployeeId: string | null;
}

/**
 * El kardex en memoria: aplica las mismas reglas que `recordStockMovement`
 * —activo y vendible solo en la venta, nunca negativo, aviso una vez por
 * cruce— y es todo o nada, igual que la transaccion real.
 */
export class InMemoryStock implements InventoryCatalog {
  readonly items = new Map<string, StockItem>();
  readonly movements: RecordedMovement[] = [];

  add(item: Partial<StockItem> & { id: string }): StockItem {
    const stored: StockItem = {
      code: `INV-${String(this.items.size + 1).padStart(4, '0')}`,
      name: 'Cera en pasta',
      kind: 'PRODUCT',
      isActive: true,
      price: 300,
      taxRate: '0.1300',
      unit: 'unidad',
      onHand: 0,
      minStock: 0,
      notified: false,
      ...item,
    };

    this.items.set(stored.id, stored);

    return stored;
  }

  onHand(id: string): Milli {
    return this.items.get(id)?.onHand ?? 0;
  }

  async findByIds(ids: readonly string[]): Promise<InventoryProductRecord[]> {
    return ids.flatMap((id) => {
      const item = this.items.get(id);

      return item === undefined ? [] : [item];
    });
  }

  async listOptions(): Promise<InventoryItemOption[]> {
    return [...this.items.values()]
      .filter((item) => item.kind === 'PRODUCT' && item.isActive)
      .map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        price: toDecimalString(item.price),
        unit: item.unit,
        stockOnHand: toQuantityString(item.onHand),
      }));
  }

  /**
   * Aplica los movimientos de un lavado (`workOrderId`) o de una venta suelta
   * (`{ counterSaleId }`, 066).
   */
  apply(
    changes: readonly ProductStockChange[],
    owner: string | { counterSaleId: string },
    actor: StatusActor,
  ): InventoryLowStockPayload[] {
    const workOrderId = typeof owner === 'string' ? owner : null;
    const saleRef = typeof owner === 'string' ? {} : { counterSaleId: owner.counterSaleId };
    const next = new Map([...this.items].map(([id, item]) => [id, { ...item }]));
    const written: RecordedMovement[] = [];
    const lowStock: InventoryLowStockPayload[] = [];

    for (const change of changes) {
      const item = next.get(change.inventoryItemId);

      if (item === undefined) throw new InventoryItemNotFoundError(change.inventoryItemId);

      const sale = change.type === 'SALE';

      if (sale && !item.isActive) throw new ItemInactiveError(item.id);
      if (sale && item.kind !== 'PRODUCT') throw new ItemNotSellableError(item.id);

      item.onHand = applyMovement(item.id, item.onHand, change.quantity);

      const transition = lowStockTransition(item.onHand, item.minStock, item.notified);

      item.notified = transition.notified;

      if (transition.notify) {
        lowStock.push({
          itemId: item.id,
          name: item.name,
          stockOnHand: toQuantityString(item.onHand),
          minStock: toQuantityString(item.minStock),
          unit: item.unit,
        });
      }

      written.push({
        itemId: item.id,
        type: change.type,
        quantity: change.quantity,
        balanceAfter: item.onHand,
        workOrderId,
        ...saleRef,
        createdByUserId: actor?.kind === 'user' ? actor.id : null,
        createdByEmployeeId: actor?.kind === 'employee' ? actor.id : null,
      });
    }

    for (const [id, item] of next) this.items.set(id, item);
    this.movements.push(...written);

    return lowStock;
  }
}

/** Publicador de avisos de minimo que solo guarda lo publicado. */
export class InMemoryLowStockEvents implements LowStockPublisher {
  readonly published: LowStockDraft[] = [];

  publishLowStock(draft: LowStockDraft): void {
    this.published.push(draft);
  }
}

function productLinesOf(items: readonly TicketItemData[]): ProductQuantity[] {
  return items.flatMap((item) =>
    item.kind === 'PRODUCT' && item.inventoryItemId !== null
      ? [{ inventoryItemId: item.inventoryItemId, quantity: item.quantity }]
      : [],
  );
}

function toItem(data: TicketItemData, index: number): TicketItem {
  return {
    id: `item-${index + 1}`,
    kind: data.kind,
    serviceId: data.serviceId,
    inventoryItemId: data.inventoryItemId,
    code: data.serviceCode,
    name: data.serviceName,
    serviceCode: data.serviceCode,
    serviceName: data.serviceName,
    catalogPrice: toDecimalString(data.catalogPrice),
    unitPrice: toDecimalString(data.unitPrice),
    quantity: toQuantityString(data.quantity),
    total: toDecimalString(lineTotal(data.unitPrice, data.quantity)),
    sortOrder: data.sortOrder,
    priceAuthorizedBy: null,
    priceAuthorizedAt: null,
    priceReason: null,
    previousUnitPrice: null,
  };
}

/**
 * Lavados en memoria que guardan sus lineas y mueven el kardex en memoria como
 * lo haria el repositorio real, en la misma «transaccion» que el ticket.
 *
 * El alta tambien escribe el cliente y el vehiculo nuevos (079), y solo
 * despues de que el kardex acepto: si rechaza, no queda ninguno de los dos.
 */
export class InMemoryTicketRepository implements TicketRepository {
  readonly rows = new Map<string, Ticket>();
  /** Los vehiculos del taller: los que el test siembra y los que nacen en un alta. */
  readonly vehicles = new Map<string, VehicleWithOwner>();
  private readonly lines = new Map<string, TicketItemData[]>();
  private sequence = 0;

  constructor(
    readonly stock: InMemoryStock,
    readonly customers = new InMemoryCustomerRepository(),
  ) {}

  get(id: string): Ticket | undefined {
    return this.rows.get(id);
  }

  set(ticket: Ticket): void {
    this.rows.set(ticket.id, ticket);
  }

  private withLines(ticket: Ticket, items: readonly TicketItemData[]): Ticket {
    this.lines.set(ticket.id, [...items]);

    return {
      ...ticket,
      items: items.map(toItem),
      total: toDecimalString(totalOf(items)),
    };
  }

  async list(): Promise<Ticket[]> {
    return [...this.rows.values()];
  }

  async findById(id: string): Promise<Ticket | null> {
    return this.rows.get(id) ?? null;
  }

  async create(data: NewTicketData, actor: StatusActor): Promise<TicketWrite> {
    // El unico parcial de la base (090 RN-1): un carro, un lavado sin cobrar.
    // Mira las filas, no `findUnchargedOfVehicle`: un test puede tapar la
    // consulta para simular la carrera, pero no el indice.
    if ('id' in data.vehicle && this.unchargedOf(data.vehicle.id) !== null) {
      throw new VehicleBusyError(null);
    }

    const id = `t${this.sequence + 1}`;
    // El kardex primero: si rechaza, sale antes de escribir cliente o vehiculo,
    // como la transaccion real que los deshace juntos (079).
    const lowStock = this.stock.apply(
      productStockChanges([], productLinesOf(data.items)),
      id,
      actor,
    );

    this.sequence += 1;

    const customer = await this.intakeCustomer(data);
    const vehicle = this.intakeVehicle(data, customer);
    const bodyType = { id: data.bodyTypeId, key: 'sedan', name: 'Sedán', sortOrder: 1 };
    const created = this.withLines(
      {
        id,
        number: `CW-${String(this.sequence).padStart(4, '0')}`,
        status: 'OPEN',
        customer,
        vehicle,
        bodyType,
        items: [],
        total: '0.00',
        washer: null,
        washers: [],
        commissionTotal: null,
        notes: data.notes ?? null,
        payments: [],
        charge: null,
        washingStartedAt: null,
        readyAt: null,
        createdAt: '2026-09-26T12:00:00.000Z',
        updatedAt: '2026-09-26T12:00:00.000Z',
      },
      data.items,
    );

    this.rows.set(id, created);

    return { ticket: created, lowStock };
  }

  private async intakeCustomer(data: NewTicketData): Promise<Customer | null> {
    if (data.customer === null) return null;
    if ('create' in data.customer) return this.customers.create(data.customer.create);

    return this.customers.findById(data.customer.id);
  }

  private intakeVehicle(data: NewTicketData, owner: Customer | null): VehicleWithOwner {
    if ('create' in data.vehicle) {
      const created: VehicleWithOwner = {
        id: `veh-${this.vehicles.size + 1}`,
        plate: data.vehicle.create.plate,
        bodyType: { id: data.vehicle.create.bodyTypeId, key: 'sedan', name: 'Sedán', sortOrder: 1 },
        make: data.vehicle.create.make ?? null,
        color: data.vehicle.create.color ?? null,
        isActive: true,
        currentOwner: owner,
        lastWash: null,
      };

      this.vehicles.set(created.id, created);

      return created;
    }

    const known = this.vehicles.get(data.vehicle.id) ?? {
      id: data.vehicle.id,
      plate: 'P001',
      bodyType: { id: data.bodyTypeId, key: 'sedan', name: 'Sedán', sortOrder: 1 },
      make: null,
      color: null,
      isActive: true,
      currentOwner: null,
      lastWash: null,
    };
    const claimed =
      data.vehicle.claimOwner && owner !== null ? { ...known, currentOwner: owner } : known;

    this.vehicles.set(claimed.id, claimed);

    return claimed;
  }

  async update(
    id: string,
    changes: TicketChanges,
    actor: StatusActor = null,
  ): Promise<TicketWrite> {
    let row = this.rows.get(id);

    if (row === undefined) throw new Error(`Unknown ticket ${id}`);

    let lowStock: InventoryLowStockPayload[] = [];

    if (changes.items !== undefined) {
      if (row.status !== 'OPEN') throw new TicketNotEditableError(id);

      const before = productLinesOf(this.lines.get(id) ?? []);

      lowStock = this.stock.apply(
        productStockChanges(before, productLinesOf(changes.items)),
        id,
        actor,
      );
      row = this.withLines(row, changes.items);
    }

    if (changes.notes !== undefined) row = { ...row, notes: changes.notes };

    this.rows.set(id, row);

    return { ticket: row, lowStock };
  }

  async findUnchargedOfVehicle(vehicleId: string): Promise<Ticket | null> {
    return this.unchargedOf(vehicleId);
  }

  private unchargedOf(vehicleId: string): Ticket | null {
    return (
      [...this.rows.values()].find(
        (row) => row.vehicle.id === vehicleId && isOperationalStatus(row.status),
      ) ?? null
    );
  }

  async setStatus(id: string, move: StatusMove, actor: StatusActor): Promise<Ticket> {
    const row = this.rows.get(id);
    const status = move.to;

    if (row === undefined) throw new Error(`Unknown ticket ${id}`);
    if (!move.from.includes(row.status)) throw new TicketStatusChangedError(id, row.status);

    if (status === 'VOID') {
      this.stock.apply(productReturnsOnVoid(productLinesOf(this.lines.get(id) ?? [])), id, actor);
    }

    const moved: Ticket = { ...row, status };

    this.rows.set(id, moved);

    return moved;
  }

  async authorizePrice(id: string, data: PriceAuthorizationData): Promise<Ticket> {
    const row = this.rows.get(id);

    if (row === undefined) throw new Error(`Unknown ticket ${id}`);
    if (row.status === 'PAID' || row.status === 'VOID') {
      throw new TicketStatusChangedError(id, row.status);
    }

    const items = (this.lines.get(id) ?? []).map((line, index) =>
      `item-${index + 1}` === data.itemId ? { ...line, unitPrice: data.unitPrice } : line,
    );
    const updated = this.withLines(row, items);

    this.rows.set(id, updated);

    return updated;
  }

  async listStatusEvents(): Promise<StatusEventRecord[]> {
    return [];
  }

  async appendNote(id: string, line: string): Promise<Ticket> {
    const row = this.rows.get(id);

    if (row === undefined) throw new Error(`Unknown ticket ${id}`);

    const noted = {
      ...row,
      notes: row.notes === null || row.notes.trim() === '' ? line : `${row.notes}\n${line}`,
    };

    this.rows.set(id, noted);

    return noted;
  }

  async replaceWashers(id: string): Promise<Ticket> {
    const row = this.rows.get(id);

    if (row === undefined) throw new Error(`Unknown ticket ${id}`);
    if (!canEditWashers(row.status)) throw new TicketStatusChangedError(id, row.status);

    return row;
  }

  async listWashingOf(employeeId: string): Promise<Ticket[]> {
    return [...this.rows.values()].filter(
      (row) => row.status === 'WASHING' && row.washers.some((washer) => washer.id === employeeId),
    );
  }

  async findActiveEmployeeIds(ids: string[]): Promise<string[]> {
    return ids;
  }

  async listActiveEmployees(): Promise<FloorEmployeeOption[]> {
    return [];
  }

  async listCommissionSnapshot(): Promise<{
    entries: CommissionEntryRecord[];
    unassigned: UnassignedCommissionRecord[];
  }> {
    return { entries: [], unassigned: [] };
  }

  async findCommissionEmployee(): Promise<null> {
    return null;
  }

  async listEmployeeCommissionWashes(): Promise<CommissionWashRecord[]> {
    return [];
  }
}
