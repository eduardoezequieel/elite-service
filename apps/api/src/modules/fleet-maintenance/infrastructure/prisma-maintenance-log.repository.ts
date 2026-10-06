import type { MaintenanceLog, MaintenanceLogsQuery, Page } from '@elite/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { pageSkip } from '../../../common/pagination/page';
import { civilToDate } from '../../../common/prisma/date-column';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type {
  MaintenanceLogRepository,
  NewMaintenanceService,
} from '../application/ports/maintenance-log.repository';
import type { LastService } from '../domain/vehicle-status';
import { LOG_INCLUDE, civilOf, toMaintenanceLog } from './expense-row';

@Injectable()
export class PrismaMaintenanceLogRepository implements MaintenanceLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: MaintenanceLogsQuery): Promise<Page<MaintenanceLog>> {
    const where: Prisma.MaintenanceLogWhereInput = {
      ...(query.vehicleId === undefined ? {} : { vehicleId: query.vehicleId }),
      ...(query.taskId === undefined ? {} : { taskId: query.taskId }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.maintenanceLog.findMany({
        where,
        include: LOG_INCLUDE,
        orderBy: [{ performedAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
        skip: pageSkip(query),
        take: query.pageSize,
      }),
      this.prisma.maintenanceLog.count({ where }),
    ]);

    return { items: rows.map(toMaintenanceLog), page: query.page, pageSize: query.pageSize, total };
  }

  async lastServices(vehicleIds: readonly string[]): Promise<LastService[]> {
    if (vehicleIds.length === 0) return [];

    // `distinct` con este orden deja la fila más reciente de cada carro × tarea.
    const rows = await this.prisma.maintenanceLog.findMany({
      where: { vehicleId: { in: [...vehicleIds] }, taskId: { not: null } },
      distinct: ['vehicleId', 'taskId'],
      orderBy: [
        { vehicleId: 'asc' },
        { taskId: 'asc' },
        { performedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      select: { vehicleId: true, taskId: true, performedAt: true, odometerKm: true },
    });

    return rows.flatMap((row) =>
      row.taskId === null
        ? []
        : [
            {
              vehicleId: row.vehicleId,
              taskId: row.taskId,
              performedAt: civilOf(row.performedAt),
              odometerKm: row.odometerKm,
            },
          ],
    );
  }

  async record(service: NewMaintenanceService): Promise<MaintenanceLog[]> {
    const performedAt = civilToDate(service.performedAt);

    return this.prisma.$transaction(async (tx) => {
      const logs: MaintenanceLog[] = [];

      for (const task of service.tasks) {
        const log = await tx.maintenanceLog.create({
          data: {
            vehicleId: service.vehicleId,
            taskId: task.taskId,
            performedAt,
            odometerKm: service.odometerKm,
            cost: task.cost,
            shop: service.shop,
            notes: storedNotes(task, service.notes),
            createdByUserId: service.createdByUserId,
          },
        });

        if (task.cost !== null) {
          await tx.fleetExpense.create({
            data: {
              vehicleId: service.vehicleId,
              type: 'MAINTENANCE',
              amount: task.cost,
              incurredAt: performedAt,
              odometerKm: service.odometerKm,
              description:
                service.shop === null ? task.taskName : `${task.taskName} · ${service.shop}`,
              maintenanceLogId: log.id,
              createdByUserId: service.createdByUserId,
            },
          });
        }

        logs.push(
          toMaintenanceLog(
            await tx.maintenanceLog.findUniqueOrThrow({
              where: { id: log.id },
              include: LOG_INCLUDE,
            }),
          ),
        );
      }

      // Solo sube: un servicio viejo cargado tarde no le baja el odómetro al carro.
      if (service.odometerKm !== null) {
        await tx.fleetVehicle.updateMany({
          where: { id: service.vehicleId, odometerKm: { lt: service.odometerKm } },
          data: { odometerKm: service.odometerKm },
        });
      }

      return logs;
    });
  }

  async remove(id: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const log = await tx.maintenanceLog.findUnique({ where: { id }, select: { id: true } });

      if (log === null) return false;

      await tx.fleetExpense.deleteMany({ where: { maintenanceLogId: id } });
      await tx.maintenanceLog.delete({ where: { id } });

      return true;
    });
  }
}

/**
 * «Otro» no tiene tarea: el nombre queda como primera línea de las notas y el
 * mapper lo vuelve a `taskName`. Una tarea del plan guarda solo la nota.
 */
function storedNotes(
  task: NewMaintenanceService['tasks'][number],
  notes: string | null,
): string | null {
  if (task.taskId !== null) return notes;

  const parts = [task.taskName, notes].filter((part) => part !== null && part.trim() !== '');

  return parts.length === 0 ? null : parts.join('\n');
}
