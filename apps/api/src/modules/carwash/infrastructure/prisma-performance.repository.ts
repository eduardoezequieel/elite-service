import { Injectable } from '@nestjs/common';
import {
  BusinessArea,
  WorkOrderEventKind,
  WorkOrderItemKind,
  WorkOrderStatus as PrismaStatus,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { fromQuantityString } from '../../inventory/domain/stock';
import type { PerformanceRepository } from '../application/ports/performance.repository';
import { civilRange } from '../domain/civil-range';
import { fromDecimalString } from '../domain/money';
import type {
  CivilRange,
  PerformanceFollowUpRecord,
  PerformanceWashRecord,
} from '../domain/performance';
import { lineTotal } from '../domain/pricing';

/**
 * Todo lo que Rendimiento necesita de un lavado cobrado en una sola consulta:
 * lineas con la bandera `isExtra` **actual** de su categoria (067 RN-4),
 * asignados, comisiones congeladas y las entradas a READY del historial.
 */
const WASH_SELECT = {
  id: true,
  number: true,
  vehicleId: true,
  bodyTypeId: true,
  chargedAt: true,
  washingStartedAt: true,
  vehicle: { select: { plate: true } },
  bodyType: { select: { name: true } },
  items: {
    orderBy: { sortOrder: 'asc' },
    select: {
      kind: true,
      serviceName: true,
      unitPrice: true,
      quantity: true,
      service: { select: { category: { select: { isExtra: true } } } },
    },
  },
  assignments: {
    orderBy: { assignedAt: 'asc' },
    select: { employee: { select: { id: true, fullName: true, isActive: true } } },
  },
  commissionEntries: { select: { employeeId: true, amount: true } },
  statusEvents: {
    where: { toStatus: PrismaStatus.READY, kind: WorkOrderEventKind.STATUS },
    select: { occurredAt: true },
  },
} satisfies Prisma.WorkOrderSelect;

type WashRow = Prisma.WorkOrderGetPayload<{ select: typeof WASH_SELECT }>;

function toWashRecord(row: WashRow): PerformanceWashRecord {
  return {
    workOrderId: row.id,
    ticketNumber: row.number,
    vehicleId: row.vehicleId,
    plate: row.vehicle.plate,
    bodyTypeId: row.bodyTypeId,
    bodyTypeName: row.bodyType.name,
    // El filtro exige chargedAt dentro de un rango: aca nunca es null.
    chargedAt: row.chargedAt ?? new Date(0),
    washingStartedAt: row.washingStartedAt,
    readyEventTimes: row.statusEvents.map((event) => event.occurredAt),
    lines: row.items.map((item) => {
      const unitPrice = fromDecimalString(item.unitPrice.toFixed(2));
      const isService = item.kind === WorkOrderItemKind.SERVICE;

      return {
        kind: isService ? ('SERVICE' as const) : ('PRODUCT' as const),
        serviceName: item.serviceName,
        unitPrice,
        total: lineTotal(unitPrice, fromQuantityString(item.quantity.toFixed(3))),
        isExtra: isService && (item.service?.category.isExtra ?? false),
      };
    }),
    washers: row.assignments.map((assignment) => ({
      employeeId: assignment.employee.id,
      fullName: assignment.employee.fullName,
      isActive: assignment.employee.isActive,
    })),
    commissions: row.commissionEntries.map((entry) => ({
      employeeId: entry.employeeId,
      amount: fromDecimalString(entry.amount.toFixed(2)),
    })),
  };
}

@Injectable()
export class PrismaPerformanceRepository implements PerformanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  listActiveEmployees(): Promise<{ id: string; fullName: string }[]> {
    return this.prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    });
  }

  findEmployee(id: string): Promise<{ id: string; fullName: string; isActive: boolean } | null> {
    return this.prisma.employee.findUnique({
      where: { id },
      select: { id: true, fullName: true, isActive: true },
    });
  }

  listActiveBodyTypes(): Promise<{ id: string; name: string }[]> {
    return this.prisma.vehicleBodyType.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async listPaidWashes(ranges: readonly CivilRange[]): Promise<PerformanceWashRecord[]> {
    if (ranges.length === 0) return [];

    const rows = await this.prisma.workOrder.findMany({
      where: {
        area: BusinessArea.CARWASH,
        status: PrismaStatus.PAID,
        OR: ranges.map((range) => ({ chargedAt: civilRange(range.from, range.to) })),
        // RN-1: al menos un asignado activo. La oficina sin empleado no cuenta.
        assignments: { some: { employee: { isActive: true } } },
      },
      select: WASH_SELECT,
    });

    return rows.map(toWashRecord);
  }

  async listFollowUps(
    vehicleIds: readonly string[],
    after: Date,
    before: Date,
  ): Promise<PerformanceFollowUpRecord[]> {
    if (vehicleIds.length === 0) return [];

    const rows = await this.prisma.workOrder.findMany({
      where: {
        area: BusinessArea.CARWASH,
        status: { not: PrismaStatus.VOID },
        vehicleId: { in: [...vehicleIds] },
        createdAt: { gt: after, lt: before },
      },
      select: {
        id: true,
        vehicleId: true,
        createdAt: true,
        assignments: {
          orderBy: { assignedAt: 'asc' },
          select: { employee: { select: { fullName: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((row) => ({
      workOrderId: row.id,
      vehicleId: row.vehicleId,
      createdAt: row.createdAt,
      washerNames: row.assignments.map((assignment) => assignment.employee.fullName),
    }));
  }
}
