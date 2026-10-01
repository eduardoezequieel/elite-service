import type { MaintenancePlanTask } from '@elite/shared';
import { Injectable } from '@nestjs/common';
import type { MaintenancePlanTask as PlanTaskRow } from '@prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { uniqueViolationOn } from '../../../common/prisma/unique-violation';
import type {
  MaintenancePlanRepository,
  NewPlanTask,
  PlanTaskChanges,
} from '../application/ports/maintenance-plan.repository';
import { MaintenanceTaskTakenError } from '../domain/plan-task';

function toPlanTask(row: PlanTaskRow): MaintenancePlanTask {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    intervalKm: row.intervalKm,
    intervalDays: row.intervalDays,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

@Injectable()
export class PrismaMaintenancePlanRepository implements MaintenancePlanRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<MaintenancePlanTask[]> {
    const rows = await this.prisma.maintenancePlanTask.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return rows.map(toPlanTask);
  }

  async findById(id: string): Promise<MaintenancePlanTask | null> {
    const row = await this.prisma.maintenancePlanTask.findUnique({ where: { id } });

    return row === null ? null : toPlanTask(row);
  }

  async create(task: NewPlanTask): Promise<MaintenancePlanTask> {
    try {
      return toPlanTask(await this.prisma.maintenancePlanTask.create({ data: task }));
    } catch (error) {
      if (uniqueViolationOn(error, 'key')) throw new MaintenanceTaskTakenError(task.name);

      throw error;
    }
  }

  async update(id: string, changes: PlanTaskChanges): Promise<MaintenancePlanTask> {
    return toPlanTask(
      await this.prisma.maintenancePlanTask.update({ where: { id }, data: changes }),
    );
  }
}
