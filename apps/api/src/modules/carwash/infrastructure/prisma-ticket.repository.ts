import { TICKET_PAYMENT_PENDING, TICKET_WASHER_NONE } from '@elite/shared';
import type { FloorEmployeeOption, Ticket, TicketListPage, WorkOrderStatus } from '@elite/shared';
import { Injectable } from '@nestjs/common';
import {
  BusinessArea,
  PaymentMethod as PrismaPaymentMethod,
  WorkOrderEventKind,
  WorkOrderItemKind,
  WorkOrderStatus as PrismaStatus,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { toQuantityString } from '../../inventory/domain/stock';
import { pageOf, skipTake } from '../../../common/pagination/page';
import { lastSequence, retryOnSequenceClash } from '../../../common/prisma/last-sequence';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { uniqueViolationOn } from '../../../common/prisma/unique-violation';
import { decimalToCents, decimalToMilli } from '../../../common/prisma/decimal';
import { transferOwnership, vehicleCreateData } from '../../vehicles/infrastructure/vehicle-writes';
import type {
  CommissionRange,
  NewTicketData,
  PriceAuthorizationData,
  StatusActor,
  StatusMove,
  TicketChanges,
  TicketFilter,
  TicketIntakeCustomer,
  TicketPageFilter,
  TicketIntakeVehicle,
  TicketItemData,
  TicketRepository,
  TicketWrite,
} from '../application/ports/ticket.repository';
import {
  TicketNotEditableError,
  TicketStatusChangedError,
  VehicleBusyError,
  VehiclePlateTakenError,
} from '../application/ports/ticket.repository';
import { civilRange } from '../domain/civil-range';
import { civilDateInBusinessZone, commissionBaseOf } from '../domain/commission';
import type {
  CommissionEntryRecord,
  CommissionWashRecord,
  UnassignedCommissionRecord,
} from '../domain/commission';
import { toDecimalString } from '../domain/money';
import { TICKET_PREFIX, nextNumber } from '../domain/numbering';
import { lineTotal, totalOf } from '../domain/pricing';
import { productReturnsOnVoid, productStockChanges } from '../domain/product-stock';
import type { ProductQuantity } from '../domain/product-stock';
import {
  summarizeTickets,
  ticketFacets,
  type TicketDigest,
  type TicketListFilters,
} from '../domain/ticket-list';
import { planTicketQuery } from '../domain/ticket-query';
import type { StatusEventRecord } from '../domain/ticket-timeline';
import { canEditWashers } from '../domain/work-order';
import { TICKET_INCLUDE, statusEventData, toTicket } from './ticket-row';
import { applyProductStock, lockWorkOrder, storedProductLines } from './ticket-stock';
import { UNCHARGED_STATUSES, isVehicleBusyViolation } from './work-order-guards';

/** Las columnas de una linea, servicio o producto (065 RN-6). */
function itemColumns(item: TicketItemData) {
  return {
    kind: item.kind === 'PRODUCT' ? WorkOrderItemKind.PRODUCT : WorkOrderItemKind.SERVICE,
    serviceId: item.serviceId,
    inventoryItemId: item.inventoryItemId,
    serviceCode: item.serviceCode,
    serviceName: item.serviceName,
    catalogPrice: toDecimalString(item.catalogPrice),
    unitPrice: toDecimalString(item.unitPrice),
    quantity: toQuantityString(item.quantity),
    taxRate: item.taxRate,
    sortOrder: item.sortOrder,
    comboId: item.comboId,
    comboName: item.comboName,
  };
}

/** El dia, o el historial del cliente (004): la base del resumen (102). */
function baseWhere(filter: { date?: string; customerId?: string }): Prisma.WorkOrderWhereInput {
  // El dominio decide si esto es «la fila de hoy» o «el historial de este
  // cliente»; aca solo se traduce a un `where` (004).
  const plan = planTicketQuery(filter);

  return {
    area: BusinessArea.CARWASH,
    ...(plan.byDay ? { createdAt: dayRange(plan.date) } : {}),
    ...(filter.customerId === undefined ? {} : { customerId: filter.customerId }),
  };
}

/** La base con estado y busqueda libre (014): lo que ve la fila antes del popover. */
function listedWhere(filter: TicketFilter): Prisma.WorkOrderWhereInput {
  const term = filter.q?.trim();
  const orConditions: Prisma.WorkOrderWhereInput[] = [];

  if (term !== undefined && term !== '') {
    const plateTerm = term.toUpperCase().replace(/\s+/g, '');
    const numberTerm = term.replace(/^#/, '').trim();

    orConditions.push(
      { vehicle: { plate: { contains: term, mode: 'insensitive' } } },
      { customer: { fullName: { contains: term, mode: 'insensitive' } } },
      { number: { contains: term, mode: 'insensitive' } },
    );

    if (plateTerm !== term && plateTerm !== '') {
      orConditions.push({ vehicle: { plate: { contains: plateTerm, mode: 'insensitive' } } });
    }

    if (numberTerm !== term && numberTerm !== '') {
      orConditions.push({ number: { contains: numberTerm, mode: 'insensitive' } });
    }
  }

  return {
    ...baseWhere(filter),
    ...(filter.statuses === undefined ? {} : { status: { in: filter.statuses as PrismaStatus[] } }),
    ...(orConditions.length > 0 ? { OR: orConditions } : {}),
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `matchesTicketFilters` (`domain/ticket-list.ts`) como `where` (102). */
function popoverWhere(filters: TicketListFilters): Prisma.WorkOrderWhereInput {
  const and: Prisma.WorkOrderWhereInput[] = [];

  if (filters.bodyTypeId !== undefined) and.push({ bodyTypeId: filters.bodyTypeId });
  if (filters.serviceId !== undefined) {
    // El valor es el id del servicio o, en lineas sin servicio enlazado, su
    // nombre. La columna es uuid: un nombre no se compara contra ella.
    const byName: Prisma.WorkOrderItemWhereInput = {
      serviceId: null,
      serviceName: filters.serviceId,
    };
    and.push({
      items: {
        some: {
          kind: WorkOrderItemKind.SERVICE,
          OR: UUID.test(filters.serviceId) ? [{ serviceId: filters.serviceId }, byName] : [byName],
        },
      },
    });
  }
  if (filters.washerId !== undefined) {
    and.push(
      filters.washerId === TICKET_WASHER_NONE
        ? { assignments: { none: {} } }
        : { assignments: { some: { employeeId: filters.washerId } } },
    );
  }
  if (filters.payment !== undefined) {
    and.push(
      filters.payment === TICKET_PAYMENT_PENDING
        ? { payments: { none: {} } }
        : { payments: { some: { method: filters.payment as PrismaPaymentMethod } } },
    );
  }

  return and.length === 0 ? {} : { AND: and };
}

/** Lo que el resumen necesita de cada lavado: estado y total. */
const SUMMARY_SELECT = {
  status: true,
  items: { select: { unitPrice: true, quantity: true } },
} satisfies Prisma.WorkOrderSelect;

/** Lo que las opciones de filtro necesitan, en el orden de la fila. */
const FACET_SELECT = {
  bodyType: { select: { id: true, name: true } },
  items: {
    where: { kind: WorkOrderItemKind.SERVICE },
    orderBy: { sortOrder: 'asc' },
    select: { serviceId: true, serviceName: true },
  },
  assignments: {
    orderBy: { assignedAt: 'asc' },
    select: { employee: { select: { id: true, fullName: true } } },
  },
} satisfies Prisma.WorkOrderSelect;

/** El relleno de las partes de un digest que una proyeccion no trae. */
const EMPTY_DIGEST: TicketDigest = {
  status: 'OPEN',
  totalCents: 0,
  bodyType: { id: '', name: '' },
  serviceLines: [],
  washers: [],
  paymentMethods: [],
};

/** Las lineas de producto de un pedido, reducidas a lo que mueve existencia. */
function productLinesOf(items: readonly TicketItemData[]): ProductQuantity[] {
  return items.flatMap((item) =>
    item.kind === 'PRODUCT' && item.inventoryItemId !== null
      ? [{ inventoryItemId: item.inventoryItemId, quantity: item.quantity }]
      : [],
  );
}

/** El responsable del alta: el que ya existe, o el que nace en este `tx` (079). */
async function intakeCustomerId(
  tx: Prisma.TransactionClient,
  customer: TicketIntakeCustomer,
): Promise<string | null> {
  if (customer === null) return null;
  if ('id' in customer) return customer.id;

  const created = await tx.customer.create({ data: customer.create, select: { id: true } });

  return created.id;
}

/**
 * El vehiculo del alta, en este `tx` (079): la ficha nueva nace con el
 * responsable como dueno; la conocida sin dueno lo toma si el alta trae uno.
 */
async function intakeVehicleId(
  tx: Prisma.TransactionClient,
  vehicle: TicketIntakeVehicle,
  customerId: string | null,
): Promise<string> {
  if ('id' in vehicle) {
    if (vehicle.claimOwner && customerId !== null) {
      await transferOwnership(tx, vehicle.id, customerId);
    }

    return vehicle.id;
  }

  try {
    const created = await tx.vehicle.create({
      data: vehicleCreateData({
        ...vehicle.create,
        ...(customerId === null ? {} : { customerId }),
      }),
      select: { id: true },
    });

    return created.id;
  } catch (error) {
    if (uniqueViolationOn(error, 'plate')) throw new VehiclePlateTakenError(vehicle.create.plate);
    throw error;
  }
}

/** La nota con una linea mas. Una nota vacia o en blanco se reemplaza. */
function appendedNotes(notes: string | null, line: string): string {
  return notes === null || notes.trim() === '' ? line : `${notes}\n${line}`;
}

/** Rango `[desde, hasta)` del dia pedido en la zona del negocio. */
function dayRange(date?: string): { gte: Date; lt: Date } {
  const day = date ?? civilDateInBusinessZone();

  return civilRange(day, day);
}

@Injectable()
export class PrismaTicketRepository implements TicketRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: TicketFilter): Promise<Ticket[]> {
    const rows = await this.prisma.workOrder.findMany({
      where: {
        ...listedWhere(filter),
        ...(filter.assignedEmployeeId === undefined
          ? {}
          : { assignments: { some: { employeeId: filter.assignedEmployeeId } } }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: TICKET_INCLUDE,
    });

    return rows.map(toTicket);
  }

  /**
   * La lista de oficina (102). Las cuentas y las opciones salen de proyecciones
   * livianas y las decide el dominio (`ticket-list.ts`): el `where` de la
   * pagina es la traduccion de `matchesTicketFilters` y nada mas.
   */
  async listPage(filter: TicketPageFilter): Promise<TicketListPage> {
    const base = baseWhere(filter);
    const listed = listedWhere(filter);
    const where: Prisma.WorkOrderWhereInput = { AND: [listed, popoverWhere(filter)] };

    const [rows, total, summaryRows, facetRows] = await this.prisma.$transaction([
      this.prisma.workOrder.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...skipTake(filter),
        include: TICKET_INCLUDE,
      }),
      this.prisma.workOrder.count({ where }),
      this.prisma.workOrder.findMany({ where: base, select: SUMMARY_SELECT }),
      this.prisma.workOrder.findMany({
        where: listed,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: FACET_SELECT,
      }),
    ]);

    return {
      ...pageOf(rows.map(toTicket), total, filter),
      summary: summarizeTickets(
        summaryRows.map((row) => ({
          ...EMPTY_DIGEST,
          status: row.status as WorkOrderStatus,
          totalCents: totalOf(
            row.items.map((item) => ({
              catalogPrice: 0,
              unitPrice: decimalToCents(item.unitPrice),
              quantity: decimalToMilli(item.quantity),
            })),
          ),
        })),
      ),
      facets: ticketFacets(
        facetRows.map((row) => ({
          ...EMPTY_DIGEST,
          bodyType: row.bodyType,
          serviceLines: row.items,
          washers: row.assignments.map((assignment) => assignment.employee),
        })),
      ),
    };
  }

  async findById(id: string): Promise<Ticket | null> {
    const row = await this.prisma.workOrder.findUnique({ where: { id }, include: TICKET_INCLUDE });

    return row === null ? null : toTicket(row);
  }

  async listLines(id: string): Promise<TicketItemData[]> {
    const rows = await this.prisma.workOrderItem.findMany({
      where: { workOrderId: id },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });

    return rows.map((row) => ({
      kind: row.kind === WorkOrderItemKind.PRODUCT ? 'PRODUCT' : 'SERVICE',
      serviceId: row.serviceId,
      inventoryItemId: row.inventoryItemId,
      serviceCode: row.serviceCode,
      serviceName: row.serviceName,
      catalogPrice: decimalToCents(row.catalogPrice),
      unitPrice: decimalToCents(row.unitPrice),
      quantity: decimalToMilli(row.quantity),
      taxRate: row.taxRate.toFixed(4),
      sortOrder: row.sortOrder,
      comboId: row.comboId,
      comboName: row.comboName,
    }));
  }

  /**
   * El correlativo se lee y se inserta dentro de la misma transaccion, y
   * `number` es unico en la base: dos altas simultaneas chocan ahi en vez de
   * colarse con el mismo folio (RN-15); el que perdio reintenta (073).
   *
   * Cliente y vehiculo nuevos van en esa misma transaccion (079): si el kardex
   * rechaza, se deshacen con el lavado. El reintento los vuelve a crear desde
   * cero, porque la transaccion que choco ya los deshizo.
   */
  async create(data: NewTicketData, actor: StatusActor): Promise<TicketWrite> {
    try {
      const { row, lowStock } = await retryOnSequenceClash('work_orders', () =>
        this.createInTransaction(data, actor),
      );

      return { ticket: toTicket(row), lowStock };
    } catch (error) {
      // Otra alta del mismo carro gano la carrera (090 RN-1): el caso de uso ya
      // habia mirado, asi que el unico de la base es lo unico que la frena.
      if (isVehicleBusyViolation(error)) throw new VehicleBusyError(null);
      throw error;
    }
  }

  async findUnchargedOfVehicle(vehicleId: string): Promise<Ticket | null> {
    const row = await this.prisma.workOrder.findFirst({
      where: { vehicleId, status: { in: [...UNCHARGED_STATUSES] } },
      include: TICKET_INCLUDE,
    });

    return row === null ? null : toTicket(row);
  }

  private createInTransaction(data: NewTicketData, actor: StatusActor) {
    return this.prisma.$transaction(async (tx) => {
      const customerId = await intakeCustomerId(tx, data.customer);
      const vehicleId = await intakeVehicleId(tx, data.vehicle, customerId);
      const last = await lastSequence(tx, 'work_orders', TICKET_PREFIX);

      const created = await tx.workOrder.create({
        data: {
          number: nextNumber(TICKET_PREFIX, last),
          area: BusinessArea.CARWASH,
          customerId,
          vehicleId,
          bodyTypeId: data.bodyTypeId,
          notes: data.notes,
          openedByEmployeeId: data.openedByEmployeeId,
          openedByUserId: data.openedByUserId,
          items: { create: data.items.map(itemColumns) },
          assignments: {
            create: data.washerIds.map((employeeId) => ({ employeeId, assignedAt: new Date() })),
          },
        },
        include: TICKET_INCLUDE,
      });

      // La apertura es el primer tramo de la linea de tiempo (046 RN-2). Va en
      // la misma transaccion que el ticket: un lavado sin fila de apertura no
      // tendria de donde contar su primer estado.
      await tx.workOrderStatusEvent.create({
        data: statusEventData(created.id, null, created.status as WorkOrderStatus, actor),
      });

      // Cada producto sale del inventario al agregarlo (065 RN-4), en esta misma
      // transaccion: sin existencia, el lavado tampoco se abre.
      const sold = await applyProductStock(
        tx,
        created.id,
        productStockChanges([], productLinesOf(data.items)),
        actor,
      );

      return { row: created, lowStock: sold };
    });
  }

  async update(
    id: string,
    changes: TicketChanges,
    actor: StatusActor = null,
  ): Promise<TicketWrite> {
    const { items, ...fields } = changes;

    const { row, lowStock } = await this.prisma.$transaction(async (tx) => {
      let moved: TicketWrite['lowStock'] = [];

      if (items !== undefined) {
        // Con el lavado bloqueado, lo guardado es lo que vale para la
        // diferencia (RN-4): dos ediciones a la vez no venden dos veces lo
        // mismo, y una anulacion que gano la carrera no queda con lineas nuevas.
        const status = await lockWorkOrder(tx, id);

        if (status !== PrismaStatus.OPEN) {
          throw new TicketNotEditableError(id);
        }

        const before = await storedProductLines(tx, id);

        await tx.workOrderItem.deleteMany({ where: { workOrderId: id } });

        if (items.length > 0) {
          await tx.workOrderItem.createMany({
            data: items.map((item) => ({ workOrderId: id, ...itemColumns(item) })),
          });
        }

        moved = await applyProductStock(
          tx,
          id,
          productStockChanges(before, productLinesOf(items)),
          actor,
        );
      }

      const updated = await tx.workOrder.update({
        where: { id },
        data: fields,
        include: TICKET_INCLUDE,
      });

      return { row: updated, lowStock: moved };
    });

    return { ticket: toTicket(row), lowStock };
  }

  /**
   * El estado y su fila de historial, juntos o ninguno (046 RN-1): una linea de
   * tiempo con agujeros no sirve para saber donde se fue el tiempo.
   */
  async setStatus(id: string, move: StatusMove, actor: StatusActor): Promise<Ticket> {
    const status = move.to;
    const row = await this.prisma.$transaction(async (tx) => {
      // El estado se mira con el lavado bloqueado (090 RN-2): lo que el caso de
      // uso leyo pudo cambiar. Un cobro, una anulacion o un cambio de oficina
      // que gano la carrera deja este sin escribir.
      const current = (await lockWorkOrder(tx, id)) as WorkOrderStatus | null;

      if (current === null) throw new Error(`Unknown work order ${id}`);
      if (!move.from.includes(current)) throw new TicketStatusChangedError(id, current);

      // Anular repone cada producto (065 RN-5). Con el lavado bloqueado, una
      // edicion simultanea no puede dejar una linea sin devolver.
      if (status === 'VOID') {
        await applyProductStock(
          tx,
          id,
          productReturnsOnVoid(await storedProductLines(tx, id)),
          actor,
        );
      }

      // La fila del historial va *antes* de releer el ticket: el `include` de
      // la lectura es el que arma `readyAt` (049), y si la escribieramos
      // despues, el pase a READY se devolveria con el READY anterior —o con
      // null— en vez de con el que acaba de ocurrir.
      await tx.workOrderStatusEvent.create({
        data: statusEventData(id, current, status, actor),
      });

      return tx.workOrder.update({
        where: { id },
        data: {
          status: status as PrismaStatus,
          washingStartedAt:
            status === 'WASHING' ? new Date() : status === 'OPEN' ? null : undefined,
        },
        include: TICKET_INCLUDE,
      });
    });

    return toTicket(row);
  }

  async listStatusEvents(id: string): Promise<StatusEventRecord[]> {
    const rows = await this.prisma.workOrderStatusEvent.findMany({
      where: { workOrderId: id },
      orderBy: { occurredAt: 'asc' },
    });

    return rows.map((row) => ({
      id: row.id,
      kind:
        row.kind === WorkOrderEventKind.PRICE_CHANGED ? ('price' as const) : ('status' as const),
      price:
        row.kind === WorkOrderEventKind.PRICE_CHANGED &&
        row.serviceName !== null &&
        row.previousUnitPrice !== null &&
        row.newUnitPrice !== null &&
        row.reason !== null
          ? {
              serviceName: row.serviceName,
              previousUnitPrice: row.previousUnitPrice.toFixed(2),
              unitPrice: row.newUnitPrice.toFixed(2),
              reason: row.reason,
            }
          : undefined,
      fromStatus: row.fromStatus === null ? null : (row.fromStatus as WorkOrderStatus),
      toStatus: row.toStatus as WorkOrderStatus,
      actorKind: row.actorKind === null ? null : row.actorKind === 'USER' ? 'user' : 'employee',
      actorName: row.actorName,
      occurredAt: row.occurredAt,
    }));
  }

  /**
   * El precio nuevo, su firma y la fila del historial, en una sola transaccion
   * (060): un precio cambiado que no se puede auditar no vale como cambio.
   *
   * La fila queda a nombre de **quien autorizo**, no de quien estaba en la
   * pantalla: lo que el dueno revisa al cierre es la firma (045 RN-5). No mueve
   * el estado, asi que repite el que tenia el lavado en `fromStatus` y
   * `toStatus`.
   */
  async authorizePrice(id: string, data: PriceAuthorizationData): Promise<Ticket> {
    const row = await this.prisma.$transaction(async (tx) => {
      // Bloqueado, igual que el cobro lo bloquea (090 RN-2): un precio no se
      // cambia sobre un lavado que otra caja acaba de cobrar.
      const status = (await lockWorkOrder(tx, id)) as WorkOrderStatus | null;

      if (status === null) throw new Error(`Unknown work order ${id}`);
      if (status === 'PAID' || status === 'VOID') throw new TicketStatusChangedError(id, status);

      const item = await tx.workOrderItem.update({
        where: { id: data.itemId },
        data: {
          unitPrice: toDecimalString(data.unitPrice),
          previousUnitPrice: toDecimalString(data.previousUnitPrice),
          priceReason: data.reason,
          priceAuthorizedByUserId: data.authorizedByUserId,
          priceAuthorizedAt: new Date(),
        },
      });

      await tx.workOrderStatusEvent.create({
        data: {
          ...statusEventData(id, status, status, {
            kind: 'user',
            id: data.authorizedByUserId,
            name: data.authorizedByName,
          }),
          kind: WorkOrderEventKind.PRICE_CHANGED,
          itemId: data.itemId,
          serviceName: item.serviceName,
          previousUnitPrice: toDecimalString(data.previousUnitPrice),
          newUnitPrice: toDecimalString(data.unitPrice),
          reason: data.reason,
        },
      });

      return tx.workOrder.findUniqueOrThrow({ where: { id }, include: TICKET_INCLUDE });
    });

    return toTicket(row);
  }

  /**
   * Lee y escribe con el lavado bloqueado (079): la segunda nota espera a que
   * la primera se confirme y la lee, en vez de pisarla con lo que habia antes.
   */
  async appendNote(id: string, line: string): Promise<Ticket> {
    const row = await this.prisma.$transaction(async (tx) => {
      await lockWorkOrder(tx, id);

      const current = await tx.workOrder.findUniqueOrThrow({
        where: { id },
        select: { notes: true },
      });

      return tx.workOrder.update({
        where: { id },
        data: { notes: appendedNotes(current.notes, line) },
        include: TICKET_INCLUDE,
      });
    });

    return toTicket(row);
  }

  async replaceWashers(id: string, employeeIds: string[]): Promise<Ticket> {
    const row = await this.prisma.$transaction(async (tx) => {
      // Un cobro que gano la carrera ya congelo la comision con el asignado
      // de antes (090 RN-2): no se cambia a quien se le pago.
      const status = (await lockWorkOrder(tx, id)) as WorkOrderStatus | null;

      if (status === null) throw new Error(`Unknown work order ${id}`);
      if (!canEditWashers(status)) throw new TicketStatusChangedError(id, status);

      await tx.workOrderAssignment.deleteMany({ where: { workOrderId: id } });

      if (employeeIds.length > 0) {
        const now = new Date();

        await tx.workOrderAssignment.createMany({
          data: employeeIds.map((employeeId) => ({ workOrderId: id, employeeId, assignedAt: now })),
        });
      }

      return tx.workOrder.findUniqueOrThrow({ where: { id }, include: TICKET_INCLUDE });
    });

    return toTicket(row);
  }

  async findActiveEmployeeIds(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];

    const rows = await this.prisma.employee.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true },
    });

    return rows.map((row) => row.id);
  }

  async listWashingOf(employeeId: string): Promise<Ticket[]> {
    const rows = await this.prisma.workOrder.findMany({
      where: {
        area: BusinessArea.CARWASH,
        status: PrismaStatus.WASHING,
        assignments: { some: { employeeId } },
      },
      orderBy: { washingStartedAt: 'asc' },
      include: TICKET_INCLUDE,
    });

    return rows.map(toTicket);
  }

  async listActiveEmployees(): Promise<FloorEmployeeOption[]> {
    return this.prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    });
  }

  async listCommissionSnapshot(range: CommissionRange): Promise<{
    entries: CommissionEntryRecord[];
    unassigned: UnassignedCommissionRecord[];
  }> {
    const chargedAt = civilRange(range.from, range.to);

    const [entryRows, unassignedRows] = await Promise.all([
      this.prisma.commissionEntry.findMany({
        where: {
          workOrder: {
            area: BusinessArea.CARWASH,
            status: PrismaStatus.PAID,
            chargedAt,
            commissionTotal: { not: null },
          },
        },
        include: COMMISSION_ENTRY_INCLUDE,
      }),
      this.prisma.workOrder.findMany({
        where: {
          area: BusinessArea.CARWASH,
          status: PrismaStatus.PAID,
          chargedAt,
          commissionTotal: { not: null },
          assignments: { none: {} },
        },
        select: { commissionTotal: true },
      }),
    ]);

    const entries: CommissionEntryRecord[] = entryRows.map(toCommissionEntry);

    const unassigned: UnassignedCommissionRecord[] = unassignedRows.map((row) => ({
      commissionTotal: row.commissionTotal === null ? 0 : decimalToCents(row.commissionTotal),
    }));

    return { entries, unassigned };
  }

  async findCommissionEmployee(
    id: string,
  ): Promise<{ id: string; fullName: string; isActive: boolean } | null> {
    return this.prisma.employee.findUnique({
      where: { id },
      select: { id: true, fullName: true, isActive: true },
    });
  }

  async listEmployeeCommissionWashes(
    employeeId: string,
    range: CommissionRange,
  ): Promise<CommissionWashRecord[]> {
    const rows = await this.prisma.commissionEntry.findMany({
      where: {
        employeeId,
        workOrder: {
          area: BusinessArea.CARWASH,
          status: PrismaStatus.PAID,
          chargedAt: civilRange(range.from, range.to),
          commissionTotal: { not: null },
        },
      },
      include: {
        ...COMMISSION_ENTRY_INCLUDE,
        workOrder: {
          include: {
            ...COMMISSION_ENTRY_INCLUDE.workOrder.include,
            vehicle: { select: { plate: true } },
          },
        },
      },
    });

    return rows.map((row) => ({
      ...toCommissionEntry(row),
      ticketNumber: row.workOrder.number,
      // El filtro exige chargedAt dentro del rango: acá nunca es null.
      chargedAt: row.workOrder.chargedAt ?? row.workOrder.updatedAt,
      plate: row.workOrder.vehicle.plate,
    }));
  }
}

/** Lo que el reporte y el detalle leen de cada `CommissionEntry` (009 RN-8, 061). */
const COMMISSION_ENTRY_INCLUDE = {
  employee: { select: { id: true, fullName: true, isActive: true } },
  workOrder: {
    include: {
      items: { select: { kind: true, unitPrice: true, quantity: true } },
      assignments: { orderBy: { assignedAt: 'asc' }, select: { employeeId: true } },
    },
  },
} satisfies Prisma.CommissionEntryInclude;

type CommissionEntryRow = Prisma.CommissionEntryGetPayload<{
  include: typeof COMMISSION_ENTRY_INCLUDE;
}>;

/**
 * Las ventas que se le atribuyen a un empleado salen de la misma base que su
 * comision: solo los servicios (065 RN-8). Un producto en el lavado no es venta
 * del que lavo.
 */
function toCommissionEntry(row: CommissionEntryRow): CommissionEntryRecord {
  const ticketTotal = commissionBaseOf(
    row.workOrder.items.map((item) => ({
      kind: item.kind,
      total: lineTotal(decimalToCents(item.unitPrice), decimalToMilli(item.quantity)),
    })),
  );
  const washerIndex = row.workOrder.assignments.findIndex(
    (assignment) => assignment.employeeId === row.employeeId,
  );

  return {
    employeeId: row.employee.id,
    fullName: row.employee.fullName,
    isActive: row.employee.isActive,
    amount: decimalToCents(row.amount),
    workOrderId: row.workOrderId,
    ticketTotal,
    washerCount: row.workOrder.assignments.length,
    washerIndex: washerIndex === -1 ? 0 : washerIndex,
  };
}
