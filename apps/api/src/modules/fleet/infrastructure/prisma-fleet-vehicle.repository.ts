import type {
  CreateFleetVehicleInput,
  FleetVehicle,
  FleetVehiclesQuery,
  Page,
  UpdateFleetVehicleInput,
} from '@elite/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { pageSkip } from '../../../common/pagination/page';
import { civilColumn } from '../../../common/prisma/date-column';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { uniqueViolationOn } from '../../../common/prisma/unique-violation';
import type { FleetVehicleRepository } from '../application/ports/fleet-vehicle.repository';
import { FleetPlateTakenError } from '../domain/fleet-vehicle';
import { toFleetVehicle } from './fleet-vehicle-row';

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

  async list(query: FleetVehiclesQuery): Promise<Page<FleetVehicle>> {
    const term = query.q?.trim();
    const contains = (value: string) => ({ contains: value, mode: 'insensitive' as const });
    const where: Prisma.FleetVehicleWhereInput = {
      // Sin estado, la lista de Carros no muestra retirados (110). `?status=RETIRED` sí.
      ...(query.status === undefined ? { status: { not: 'RETIRED' } } : { status: query.status }),
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
    };

    // El enum de Postgres ordena como se declaró: ACTIVE, IN_SHOP, RETIRED.
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.fleetVehicle.findMany({
        where,
        orderBy: [
          { status: 'asc' },
          { make: 'asc' },
          { model: 'asc' },
          { plate: 'asc' },
          { id: 'asc' },
        ],
        skip: pageSkip(query),
        take: query.pageSize,
      }),
      this.prisma.fleetVehicle.count({ where }),
    ]);

    return { items: rows.map(toFleetVehicle), page: query.page, pageSize: query.pageSize, total };
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
