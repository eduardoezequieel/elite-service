import type { AgreementStatus, MaintenancePlanTask } from '@elite/shared';
import { Injectable } from '@nestjs/common';

import { dateToCivil } from '../../../common/prisma/date-column';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { LastService } from '../../fleet-maintenance/domain/vehicle-status';
import type { FleetDayContext, FleetDaySource } from '../application/ports/fleet-day.source';
import { DEFAULT_DAYS_ALERT, DEFAULT_KM_ALERT } from '../domain/fleet-day';

/**
 * El día de la flota, leído en Prisma (110). Vive en este módulo y no importa
 * el de mantenimiento: ese ya importa la flota, y al revés sería un ciclo.
 */
@Injectable()
export class PrismaFleetDaySource implements FleetDaySource {
  constructor(private readonly prisma: PrismaService) {}

  async load(vehicleIds: readonly string[]): Promise<FleetDayContext> {
    const settings = await this.prisma.rentalSettings.findUnique({
      where: { key: 'default' },
      select: { kmAlert: true, daysAlert: true },
    });
    const kmAlert = settings?.kmAlert ?? DEFAULT_KM_ALERT;
    const daysAlert = settings?.daysAlert ?? DEFAULT_DAYS_ALERT;

    if (vehicleIds.length === 0) {
      return { agreements: [], plan: [], lastServices: [], kmAlert, daysAlert };
    }

    const ids = [...vehicleIds];
    const [agreements, plan, lastServices] = await Promise.all([
      this.prisma.rentalAgreement.findMany({
        where: { vehicleId: { in: ids }, status: { in: ['RESERVED', 'IN_PROGRESS'] } },
        select: {
          id: true,
          vehicleId: true,
          status: true,
          plannedPickupAt: true,
          plannedReturnAt: true,
        },
      }),
      this.prisma.maintenancePlanTask.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.lastServices(ids),
    ]);

    return {
      agreements: agreements.map((agreement) => ({
        id: agreement.id,
        vehicleId: agreement.vehicleId,
        status: agreement.status as AgreementStatus,
        plannedPickupAt: agreement.plannedPickupAt.toISOString(),
        plannedReturnAt: agreement.plannedReturnAt.toISOString(),
      })),
      plan: plan.map(toPlanTask),
      lastServices,
      kmAlert,
      daysAlert,
    };
  }

  /** El último servicio de cada carro × tarea. Misma lectura que el mantenimiento (099). */
  private async lastServices(vehicleIds: string[]): Promise<LastService[]> {
    const rows = await this.prisma.maintenanceLog.findMany({
      where: { vehicleId: { in: vehicleIds }, taskId: { not: null } },
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
              performedAt: dateToCivil(row.performedAt) ?? '',
              odometerKm: row.odometerKm,
            },
          ],
    );
  }
}

function toPlanTask(row: {
  id: string;
  key: string;
  name: string;
  intervalKm: number | null;
  intervalDays: number | null;
  sortOrder: number;
  isActive: boolean;
}): MaintenancePlanTask {
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
