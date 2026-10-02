import type {
  CreateFleetVehicleInput,
  FleetVehicle,
  FleetVehiclesQuery,
  UpdateFleetVehicleInput,
} from '@elite/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { civilColumn } from '../../../common/prisma/date-column';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { uniqueViolationOn } from '../../../common/prisma/unique-violation';
import type { FleetVehicleRepository } from '../application/ports/fleet-vehicle.repository';
import { FleetPlateTakenError } from '../domain/fleet-vehicle';
import { toFleetVehicle } from './fleet-vehicle-row';

/** Orden del estado en la lista: lo que se renta arriba, lo retirado al fondo. */
const STATUS_ORDER = { ACTIVE: 0, IN_SHOP: 1, RETIRED: 2 } as const;

/** Las cuatro fechas civiles del carro pasan a `@db.Date`; lo demás va tal cual. */
function withDates<T extends CreateFleetVehicleInput | UpdateFleetVehicleInput>(input: T) {
  const { purchasedAt, financingStartedAt, insuranceExpiresAt, registrationExpiresAt, ...rest } =
    input;

  return {
    ...rest,
    purchasedAt: civilColumn(purchasedAt),
    financingStartedAt: civilColumn(financingStartedAt),
    insuranceExpiresAt: civilColumn(insuranceExpiresAt),
    registrationExpiresAt: civilColumn(registrationExpiresAt),
  };
}

@Injectable()
export class PrismaFleetVehicleRepository implements FleetVehicleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: FleetVehiclesQuery): Promise<FleetVehicle[]> {
    const term = query.q?.trim();
    const contains = (value: string) => ({ contains: value, mode: 'insensitive' as const });

    const rows = await this.prisma.fleetVehicle.findMany({
      where: {
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(term === undefined || term === ''
          ? {}
          : {
              OR: [
                { plate: contains(term.replace(/\s+/g, '')) },
                { make: contains(term) },
                { model: contains(term) },
                { color: contains(term) },
              ],
            }),
      },
      orderBy: [{ make: 'asc' }, { model: 'asc' }, { plate: 'asc' }],
    });

    return rows
      .map(toFleetVehicle)
      .sort((left, right) => STATUS_ORDER[left.status] - STATUS_ORDER[right.status]);
  }

  async findById(id: string): Promise<FleetVehicle | null> {
    const row = await this.prisma.fleetVehicle.findUnique({ where: { id } });

    return row === null ? null : toFleetVehicle(row);
  }

  async existsByPlate(plate: string, exceptId?: string): Promise<boolean> {
    const count = await this.prisma.fleetVehicle.count({
      where: { plate, ...(exceptId === undefined ? {} : { id: { not: exceptId } }) },
    });

    return count > 0;
  }

  async create(data: CreateFleetVehicleInput): Promise<FleetVehicle> {
    try {
      const row = await this.prisma.fleetVehicle.create({
        data: withDates(data) satisfies Prisma.FleetVehicleUncheckedCreateInput,
      });

      return toFleetVehicle(row);
    } catch (error) {
      if (uniqueViolationOn(error, 'plate')) throw new FleetPlateTakenError(data.plate ?? '');

      throw error;
    }
  }

  async update(id: string, changes: UpdateFleetVehicleInput): Promise<FleetVehicle> {
    try {
      const row = await this.prisma.fleetVehicle.update({
        where: { id },
        data: withDates(changes),
      });

      return toFleetVehicle(row);
    } catch (error) {
      if (uniqueViolationOn(error, 'plate')) throw new FleetPlateTakenError(changes.plate ?? '');

      throw error;
    }
  }
}
