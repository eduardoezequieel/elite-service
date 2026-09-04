import type { Ticket, WorkOrderStatus } from '@elite/shared';
import { Injectable } from '@nestjs/common';
import { BusinessArea, WorkOrderStatus as PrismaStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { TICKET_PREFIX, nextNumber } from '../domain/numbering';
import { planTicketQuery } from '../domain/ticket-query';
import { fromDecimalString, toDecimalString } from '../domain/money';
import { totalOf } from '../domain/pricing';
import type {
  ChargeData,
  NewTicketData,
  TicketChanges,
  TicketFilter,
  TicketRepository,
} from '../application/ports/ticket.repository';

/** Zona del negocio. La fila de "hoy" es el hoy del taller, no el del servidor. */
const TIME_ZONE = 'America/El_Salvador';

const INCLUDE = {
  customer: true,
  vehicle: { include: { bodyType: true } },
  bodyType: true,
  items: { orderBy: { sortOrder: 'asc' } },
  openedBy: true,
  payment: true,
} satisfies Prisma.WorkOrderInclude;

type TicketRow = Prisma.WorkOrderGetPayload<{ include: typeof INCLUDE }>;

function toTicket(row: TicketRow): Ticket {
  const items = row.items.map((item) => ({
    id: item.id,
    serviceId: item.serviceId,
    serviceCode: item.serviceCode,
    serviceName: item.serviceName,
    catalogPrice: item.catalogPrice.toFixed(2),
    unitPrice: item.unitPrice.toFixed(2),
    sortOrder: item.sortOrder,
  }));

  // El total se recalcula al leer en vez de guardarse: una columna `total`
  // podria quedar desincronizada de sus lineas, y entonces RN-10 —que compara
  // el monto cobrado contra el total— estaria comparando contra una mentira.
  //
  // La suma pasa por centavos enteros, nunca por `number` decimal: es el motivo
  // de existir del modulo `money`.
  const total = totalOf(
    row.items.map((item) => ({
      catalogPrice: fromDecimalString(item.catalogPrice.toFixed(2)),
      unitPrice: fromDecimalString(item.unitPrice.toFixed(2)),
    })),
  );

  return {
    id: row.id,
    number: row.number,
    status: row.status as WorkOrderStatus,
    customer: {
      id: row.customer.id,
      fullName: row.customer.fullName,
      phone: row.customer.phone,
      isActive: row.customer.isActive,
    },
    vehicle: {
      id: row.vehicle.id,
      plate: row.vehicle.plate,
      bodyType: {
        id: row.vehicle.bodyType.id,
        key: row.vehicle.bodyType.key,
        name: row.vehicle.bodyType.name,
        sortOrder: row.vehicle.bodyType.sortOrder,
      },
      make: row.vehicle.make,
      color: row.vehicle.color,
      isActive: row.vehicle.isActive,
      currentOwner: null,
    },
    bodyType: {
      id: row.bodyType.id,
      key: row.bodyType.key,
      name: row.bodyType.name,
      sortOrder: row.bodyType.sortOrder,
    },
    items,
    total: toDecimalString(total),
    washer:
      row.openedBy === null
        ? null
        : {
            id: row.openedBy.id,
            username: row.openedBy.username,
            fullName: row.openedBy.fullName,
          },
    notes: row.notes,
    payment:
      row.payment === null
        ? null
        : {
            method: row.payment.method,
            amount: row.payment.amount.toFixed(2),
            paidAt: row.payment.paidAt.toISOString(),
          },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Rango `[desde, hasta)` del dia pedido en la zona del negocio. */
function dayRange(date?: string): { gte: Date; lt: Date } {
  const day = date ?? new Date().toLocaleDateString('en-CA', { timeZone: TIME_ZONE });
  const start = new Date(`${day}T00:00:00`);
  const end = new Date(start);

  end.setDate(end.getDate() + 1);

  return { gte: start, lt: end };
}

@Injectable()
export class PrismaTicketRepository implements TicketRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: TicketFilter): Promise<Ticket[]> {
    // El dominio decide si esto es «la fila de hoy» o «el historial de este
    // cliente»; aca solo se traduce a un `where` (004).
    const plan = planTicketQuery(filter);

    const rows = await this.prisma.workOrder.findMany({
      where: {
        area: BusinessArea.CARWASH,
        ...(plan.byDay ? { createdAt: dayRange(plan.date) } : {}),
        ...(filter.customerId === undefined ? {} : { customerId: filter.customerId }),
        ...(filter.statuses === undefined
          ? {}
          : { status: { in: filter.statuses as PrismaStatus[] } }),
      },
      orderBy: { createdAt: 'desc' },
      ...(plan.limit === null ? {} : { take: plan.limit }),
      include: INCLUDE,
    });

    return rows.map(toTicket);
  }

  async findById(id: string): Promise<Ticket | null> {
    const row = await this.prisma.workOrder.findUnique({ where: { id }, include: INCLUDE });

    return row === null ? null : toTicket(row);
  }

  /**
   * El correlativo se lee y se inserta dentro de la misma transaccion, y
   * `number` es unico en la base: dos altas simultaneas chocan ahi en vez de
   * colarse con el mismo folio (RN-15).
   */
  async create(data: NewTicketData): Promise<Ticket> {
    const row = await this.prisma.$transaction(async (tx) => {
      const last = await tx.workOrder.findFirst({
        where: { area: BusinessArea.CARWASH },
        orderBy: { number: 'desc' },
        select: { number: true },
      });

      return tx.workOrder.create({
        data: {
          number: nextNumber(TICKET_PREFIX, last?.number ?? null),
          area: BusinessArea.CARWASH,
          customerId: data.customerId,
          vehicleId: data.vehicleId,
          bodyTypeId: data.bodyTypeId,
          notes: data.notes,
          openedByEmployeeId: data.openedByEmployeeId,
          openedByUserId: data.openedByUserId,
          items: {
            create: data.items.map((item) => ({
              serviceId: item.serviceId,
              serviceCode: item.serviceCode,
              serviceName: item.serviceName,
              catalogPrice: toDecimalString(item.catalogPrice),
              unitPrice: toDecimalString(item.unitPrice),
              taxRate: item.taxRate,
              sortOrder: item.sortOrder,
            })),
          },
          // El lavador queda asentado para comisiones futuras (RN-8).
          assignments:
            data.openedByEmployeeId === null
              ? undefined
              : { create: { employeeId: data.openedByEmployeeId } },
        },
        include: INCLUDE,
      });
    });

    return toTicket(row);
  }

  async update(id: string, changes: TicketChanges): Promise<Ticket> {
    const { items, ...fields } = changes;

    const row = await this.prisma.$transaction(async (tx) => {
      if (items !== undefined) {
        await tx.workOrderItem.deleteMany({ where: { workOrderId: id } });

        if (items.length > 0) {
          await tx.workOrderItem.createMany({
            data: items.map((item) => ({
              workOrderId: id,
              serviceId: item.serviceId,
              serviceCode: item.serviceCode,
              serviceName: item.serviceName,
              catalogPrice: toDecimalString(item.catalogPrice),
              unitPrice: toDecimalString(item.unitPrice),
              taxRate: item.taxRate,
              sortOrder: item.sortOrder,
            })),
          });
        }
      }

      return tx.workOrder.update({ where: { id }, data: fields, include: INCLUDE });
    });

    return toTicket(row);
  }

  async setStatus(id: string, status: WorkOrderStatus): Promise<Ticket> {
    const row = await this.prisma.workOrder.update({
      where: { id },
      data: { status: status as PrismaStatus },
      include: INCLUDE,
    });

    return toTicket(row);
  }

  /**
   * Pago y cambio de estado, juntos o ninguno: un ticket `PAID` sin fila de
   * pago seria plata cobrada que el sistema no puede mostrar (RN-10).
   */
  async charge(id: string, data: ChargeData): Promise<Ticket> {
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          workOrderId: id,
          method: data.method,
          amount: toDecimalString(data.amount),
          recordedByUserId: data.userId,
        },
      });

      return tx.workOrder.update({
        where: { id },
        data: {
          status: PrismaStatus.PAID,
          chargedByUserId: data.userId,
          chargedAt: new Date(),
        },
        include: INCLUDE,
      });
    });

    return toTicket(row);
  }

  async employeeIsActive(id: string): Promise<boolean> {
    const found = await this.prisma.employee.findFirst({
      where: { id, isActive: true },
      select: { id: true },
    });

    return found !== null;
  }
}
