import type { FloorEmployeeOption, Ticket, TicketWasher, WorkOrderStatus } from '@elite/shared';
import { Injectable } from '@nestjs/common';
import { BusinessArea, WorkOrderStatus as PrismaStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { CashSessionGoneError } from '../application/ports/cash-session.repository';
import { TicketNotReversibleError } from '../application/ports/ticket.repository';
import type {
  ChargeData,
  CommissionRange,
  NewTicketData,
  TicketChanges,
  TicketFilter,
  TicketRepository,
} from '../application/ports/ticket.repository';
import type { CommissionEntryRecord, UnassignedCommissionRecord } from '../domain/commission';
import { fromDecimalString, toDecimalString } from '../domain/money';
import { TICKET_PREFIX, nextNumber } from '../domain/numbering';
import { totalOf } from '../domain/pricing';
import { planTicketQuery } from '../domain/ticket-query';

/** Zona del negocio. La fila de "hoy" es el hoy del taller, no el del servidor. */
const TIME_ZONE = 'America/El_Salvador';

const INCLUDE = {
  customer: true,
  vehicle: { include: { bodyType: true } },
  bodyType: true,
  items: { orderBy: { sortOrder: 'asc' } },
  openedBy: true,
  payment: true,
  assignments: { include: { employee: true }, orderBy: { assignedAt: 'asc' } },
} satisfies Prisma.WorkOrderInclude;

type TicketRow = Prisma.WorkOrderGetPayload<{ include: typeof INCLUDE }>;

function toWasher(employee: { id: string; username: string; fullName: string }): TicketWasher {
  return { id: employee.id, username: employee.username, fullName: employee.fullName };
}

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
    washer: row.openedBy === null ? null : toWasher(row.openedBy),
    washers: row.assignments.map((assignment) => toWasher(assignment.employee)),
    commissionTotal: row.commissionTotal === null ? null : row.commissionTotal.toFixed(2),
    notes: row.notes,
    payment:
      row.payment === null
        ? null
        : {
            method: row.payment.method,
            amount: row.payment.amount.toFixed(2),
            paidAt: row.payment.paidAt.toISOString(),
          },
    washingStartedAt: row.washingStartedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Rango `[desde, hasta]` civil, como `[gte, lt)` en Date local. */
function civilRange(from: string, to: string): { gte: Date; lt: Date } {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);

  end.setDate(end.getDate() + 1);

  return { gte: start, lt: end };
}

/** Rango `[desde, hasta)` del dia pedido en la zona del negocio. */
function dayRange(date?: string): { gte: Date; lt: Date } {
  const day = date ?? new Date().toLocaleDateString('en-CA', { timeZone: TIME_ZONE });

  return civilRange(day, day);
}

@Injectable()
export class PrismaTicketRepository implements TicketRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: TicketFilter): Promise<Ticket[]> {
    // El dominio decide si esto es «la fila de hoy» o «el historial de este
    // cliente»; aca solo se traduce a un `where` (004).
    const plan = planTicketQuery(filter);

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

    const rows = await this.prisma.workOrder.findMany({
      where: {
        area: BusinessArea.CARWASH,
        ...(plan.byDay ? { createdAt: dayRange(plan.date) } : {}),
        ...(filter.customerId === undefined ? {} : { customerId: filter.customerId }),
        ...(filter.statuses === undefined
          ? {}
          : { status: { in: filter.statuses as PrismaStatus[] } }),
        ...(orConditions.length > 0 ? { OR: orConditions } : {}),
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
          assignments: {
            create: data.washerIds.map((employeeId, index) => ({
              employeeId,
              assignedAt: new Date(Date.now() + index),
            })),
          },
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
      data: {
        status: status as PrismaStatus,
        washingStartedAt:
          status === 'WASHING' ? new Date() : status === 'OPEN' ? null : undefined,
      },
      include: INCLUDE,
    });

    return toTicket(row);
  }

  /**
   * Pago, estado y comisión, juntos o ninguno: un ticket `PAID` sin fila de
   * pago sería plata cobrada que el sistema no puede mostrar (RN-10), y la
   * comisión se congela en esta misma transacción (009 RN-1, RN-8).
   */
  async charge(id: string, data: ChargeData): Promise<Ticket> {
    const row = await this.prisma.$transaction(async (tx) => {
      const open = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM cash_sessions
        WHERE id = ${data.cashSessionId}::uuid AND status = 'OPEN'
        FOR UPDATE
      `;

      if (open.length === 0) {
        throw new CashSessionGoneError();
      }

      await tx.payment.create({
        data: {
          workOrderId: id,
          method: data.method,
          amount: toDecimalString(data.amount),
          recordedByUserId: data.userId,
          cashSessionId: data.cashSessionId,
        },
      });

      if (data.entries.length > 0) {
        await tx.commissionEntry.createMany({
          data: data.entries.map((entry) => ({
            workOrderId: id,
            employeeId: entry.employeeId,
            amount: toDecimalString(entry.amount),
          })),
        });
      }

      return tx.workOrder.update({
        where: { id },
        data: {
          status: PrismaStatus.PAID,
          chargedByUserId: data.userId,
          chargedAt: new Date(),
          commissionTotal: toDecimalString(data.commissionTotal),
        },
        include: INCLUDE,
      });
    });

    return toTicket(row);
  }

  async reverse(
    id: string,
    data: { reason: string; cashSessionId: string },
  ): Promise<Ticket> {
    const row = await this.prisma.$transaction(async (tx) => {
      const open = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM cash_sessions
        WHERE id = ${data.cashSessionId}::uuid AND status = 'OPEN'
        FOR UPDATE
      `;

      if (open.length === 0) {
        throw new CashSessionGoneError();
      }

      const payment = await tx.payment.findUnique({ where: { workOrderId: id } });

      if (payment === null || payment.cashSessionId !== data.cashSessionId) {
        throw new TicketNotReversibleError();
      }

      await tx.payment.delete({ where: { workOrderId: id } });
      await tx.commissionEntry.deleteMany({ where: { workOrderId: id } });

      const current = await tx.workOrder.findUniqueOrThrow({ where: { id } });
      const note = `Reverso: ${data.reason}`;
      const notes =
        current.notes === null || current.notes.trim() === ''
          ? note
          : `${current.notes}\n${note}`;

      return tx.workOrder.update({
        where: { id },
        data: {
          status: PrismaStatus.READY,
          chargedByUserId: null,
          chargedAt: null,
          commissionTotal: null,
          notes,
        },
        include: INCLUDE,
      });
    });

    return toTicket(row);
  }

  async replaceWashers(id: string, employeeIds: string[]): Promise<Ticket> {
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.workOrderAssignment.deleteMany({ where: { workOrderId: id } });

      if (employeeIds.length > 0) {
        const now = Date.now();

        await tx.workOrderAssignment.createMany({
          data: employeeIds.map((employeeId, index) => ({
            workOrderId: id,
            employeeId,
            assignedAt: new Date(now + index),
          })),
        });
      }

      return tx.workOrder.findUniqueOrThrow({ where: { id }, include: INCLUDE });
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
        include: {
          employee: { select: { id: true, fullName: true, isActive: true } },
          workOrder: {
            include: {
              items: { select: { unitPrice: true } },
              assignments: { orderBy: { assignedAt: 'asc' }, select: { employeeId: true } },
            },
          },
        },
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

    const entries: CommissionEntryRecord[] = entryRows.map((row) => {
      const ticketTotal = totalOf(
        row.workOrder.items.map((item) => {
          const unitPrice = fromDecimalString(item.unitPrice.toFixed(2));

          return { catalogPrice: unitPrice, unitPrice };
        }),
      );
      const washerIndex = row.workOrder.assignments.findIndex(
        (assignment) => assignment.employeeId === row.employeeId,
      );

      return {
        employeeId: row.employee.id,
        fullName: row.employee.fullName,
        isActive: row.employee.isActive,
        amount: fromDecimalString(row.amount.toFixed(2)),
        workOrderId: row.workOrderId,
        ticketTotal,
        washerCount: row.workOrder.assignments.length,
        washerIndex: washerIndex === -1 ? 0 : washerIndex,
      };
    });

    const unassigned: UnassignedCommissionRecord[] = unassignedRows.map((row) => ({
      commissionTotal: fromDecimalString(
        row.commissionTotal === null ? '0.00' : row.commissionTotal.toFixed(2),
      ),
    }));

    return { entries, unassigned };
  }
}
