import type {
  CreateFleetExpenseInput,
  FleetExpenseRow,
  UpdateFleetExpenseInput,
} from '@elite/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { civilToDate } from '../../../common/prisma/date-column';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type {
  ExpenseFilter,
  FleetExpenseRepository,
} from '../application/ports/fleet-expense.repository';
import { VEHICLE_REF_SELECT, toManualExpense } from './expense-row';

const INCLUDE = { vehicle: { select: VEHICLE_REF_SELECT } } satisfies Prisma.FleetExpenseInclude;

/** El rango civil inclusive sobre una columna `@db.Date`. */
export function civilRange(filter: {
  from?: string;
  to?: string;
}): Prisma.DateTimeFilter | undefined {
  if (filter.from === undefined && filter.to === undefined) return undefined;

  return {
    ...(filter.from === undefined ? {} : { gte: civilToDate(filter.from) }),
    ...(filter.to === undefined ? {} : { lte: civilToDate(filter.to) }),
  };
}

/** Los gastos anotados (`fleet_expenses`, 099 RN-3). */
@Injectable()
export class PrismaFleetExpenseRepository implements FleetExpenseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: ExpenseFilter): Promise<FleetExpenseRow[]> {
    const incurredAt = civilRange(filter);
    const rows = await this.prisma.fleetExpense.findMany({
      where: {
        ...(filter.vehicleId === undefined ? {} : { vehicleId: filter.vehicleId }),
        ...(filter.type === undefined ? {} : { type: filter.type }),
        ...(incurredAt === undefined ? {} : { incurredAt }),
      },
      include: INCLUDE,
      orderBy: [{ incurredAt: 'desc' }, { createdAt: 'desc' }],
    });

    return rows.map(toManualExpense);
  }

  async findById(id: string): Promise<FleetExpenseRow | null> {
    const row = await this.prisma.fleetExpense.findUnique({ where: { id }, include: INCLUDE });

    return row === null ? null : toManualExpense(row);
  }

  async create(
    input: Omit<CreateFleetExpenseInput, 'type'> & {
      type: FleetExpenseRow['type'];
      createdByUserId: string;
    },
  ): Promise<FleetExpenseRow> {
    const row = await this.prisma.fleetExpense.create({
      data: {
        vehicleId: input.vehicleId,
        type: input.type,
        amount: input.amount,
        incurredAt: civilToDate(input.incurredAt),
        odometerKm: input.odometerKm ?? null,
        description: input.description ?? null,
        createdByUserId: input.createdByUserId,
      },
      include: INCLUDE,
    });

    return toManualExpense(row);
  }

  async update(id: string, changes: UpdateFleetExpenseInput): Promise<FleetExpenseRow> {
    const { incurredAt, ...rest } = changes;
    const row = await this.prisma.fleetExpense.update({
      where: { id },
      data: {
        ...rest,
        ...(incurredAt === undefined ? {} : { incurredAt: civilToDate(incurredAt) }),
      },
      include: INCLUDE,
    });

    return toManualExpense(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.fleetExpense.delete({ where: { id } });
  }
}
