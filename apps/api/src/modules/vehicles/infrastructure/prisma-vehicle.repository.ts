import type {
  Page,
  PageQuery,
  VehicleBodyType,
  VehicleWithOwner,
  WorkOrderStatus,
} from '@elite/shared';
import { Injectable } from '@nestjs/common';
import { WorkOrderStatus as PrismaStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { pageOf, skipTake } from '../../../common/pagination/page';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type {
  NewVehicleData,
  VehicleChanges,
  VehicleFilter,
  VehicleRepository,
  VehicleWash,
} from '../application/ports/vehicle.repository';
import { lastWashOf } from '../domain/last-wash';
import { LAST_WASH_INCLUDE, toLastWashSource } from './last-wash-row';
import { transferOwnership, vehicleCreateData } from './vehicle-writes';

/** El último ticket no anulado: oficina y pista lo leen del lookup (041). */
const LAST_WASH = {
  where: { status: { not: PrismaStatus.VOID } },
  orderBy: { createdAt: 'desc' as const },
  take: 1,
  include: LAST_WASH_INCLUDE,
} satisfies Prisma.Vehicle$workOrdersArgs;

/** Trae el vehiculo con su tipo y **solo** la fila de propiedad vigente. */
const INCLUDE = {
  bodyType: true,
  owners: { where: { isCurrent: true }, include: { customer: true }, take: 1 },
  workOrders: LAST_WASH,
} satisfies Prisma.VehicleInclude;

type VehicleRow = Prisma.VehicleGetPayload<{ include: typeof INCLUDE }>;

function toVehicle(row: VehicleRow): VehicleWithOwner {
  const owner = row.owners[0]?.customer ?? null;
  const [previous] = row.workOrders;

  return {
    id: row.id,
    plate: row.plate,
    bodyType: {
      id: row.bodyType.id,
      key: row.bodyType.key,
      name: row.bodyType.name,
      sortOrder: row.bodyType.sortOrder,
    },
    make: row.make,
    color: row.color,
    isActive: row.isActive,
    currentOwner:
      owner === null ? null : { id: owner.id, fullName: owner.fullName, phone: owner.phone },
    lastWash: lastWashOf(previous === undefined ? undefined : toLastWashSource(previous)),
  };
}

@Injectable()
export class PrismaVehicleRepository implements VehicleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async search(filter: VehicleFilter = {}): Promise<VehicleWithOwner[]> {
    const rows = await this.prisma.vehicle.findMany({
      where: vehicleWhere(filter),
      orderBy: { plate: 'asc' },
      include: INCLUDE,
    });

    return rows.map(toVehicle);
  }

  async searchPage(filter: VehicleFilter, page: PageQuery): Promise<Page<VehicleWithOwner>> {
    const where = vehicleWhere(filter);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({
        where,
        orderBy: [{ plate: 'asc' }, { id: 'asc' }],
        include: INCLUDE,
        ...skipTake(page),
      }),
      this.prisma.vehicle.count({ where }),
    ]);

    return pageOf(rows.map(toVehicle), total, page);
  }

  async findById(id: string): Promise<VehicleWithOwner | null> {
    const row = await this.prisma.vehicle.findUnique({ where: { id }, include: INCLUDE });

    return row === null ? null : toVehicle(row);
  }

  async findByPlate(plate: string): Promise<VehicleWithOwner | null> {
    const row = await this.prisma.vehicle.findUnique({ where: { plate }, include: INCLUDE });

    return row === null ? null : toVehicle(row);
  }

  async existsByPlate(plate: string, exceptId?: string): Promise<boolean> {
    const found = await this.prisma.vehicle.findFirst({
      where: { plate, ...(exceptId === undefined ? {} : { id: { not: exceptId } }) },
      select: { id: true },
    });

    return found !== null;
  }

  async create(data: NewVehicleData): Promise<VehicleWithOwner> {
    const row = await this.prisma.vehicle.create({
      data: vehicleCreateData(data),
      include: INCLUDE,
    });

    return toVehicle(row);
  }

  /**
   * El cambio de dueno y el resto de los campos se escriben en una sola
   * transaccion: si falla a la mitad, el vehiculo no queda con la placa nueva y
   * el dueno viejo (RN-12).
   */
  async update(id: string, changes: VehicleChanges): Promise<VehicleWithOwner> {
    const { customerId, ...fields } = changes;

    const row = await this.prisma.$transaction(async (tx) => {
      if (customerId !== undefined) await transferOwnership(tx, id, customerId);

      return tx.vehicle.update({ where: { id }, data: fields, include: INCLUDE });
    });

    return toVehicle(row);
  }

  async listBodyTypes(): Promise<VehicleBodyType[]> {
    return this.prisma.vehicleBodyType.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, key: true, name: true, sortOrder: true },
    });
  }

  async bodyTypeExists(id: string): Promise<boolean> {
    const found = await this.prisma.vehicleBodyType.findFirst({
      where: { id, isActive: true },
      select: { id: true },
    });

    return found !== null;
  }

  async findUnchargedWash(vehicleId: string): Promise<VehicleWash | null> {
    const found = await this.prisma.workOrder.findFirst({
      where: {
        vehicleId,
        status: { in: [PrismaStatus.OPEN, PrismaStatus.WASHING, PrismaStatus.READY] },
      },
      select: { id: true, number: true, status: true },
    });

    return found === null
      ? null
      : { id: found.id, number: found.number, status: found.status as WorkOrderStatus };
  }
}

/**
 * Variantes de placa para `contains`: tal cual, compacta (sin espacios ni
 * guiones) y la forma A000-000 si el compacto es letra + 4-6 digitos. La base
 * guarda las dos formas; el cliente puede mandar cualquiera.
 */
function plateSearchTerms(term: string): string[] {
  const compact = term.toUpperCase().replace(/[\s-]/g, '');
  const terms = new Set<string>([term]);

  if (compact !== '') terms.add(compact);

  const match = compact.match(/^([A-Z])(\d{4,6})$/);

  if (match !== null) {
    const [, letter, digits] = match;
    terms.add(`${letter}${digits.slice(0, 3)}-${digits.slice(3)}`);
  }

  return [...terms];
}

/** Activos, por pedazo de placa y, con `customerId`, los que hoy son de ese cliente. */
function vehicleWhere(filter: VehicleFilter): Prisma.VehicleWhereInput {
  const trimmed = filter.query?.trim();
  const plateTerms = trimmed === undefined || trimmed === '' ? [] : plateSearchTerms(trimmed);

  return {
    isActive: true,
    ...(plateTerms.length === 0
      ? {}
      : {
          OR: plateTerms.map((term) => ({
            plate: { contains: term, mode: 'insensitive' as const },
          })),
        }),
    // Los carros que HOY son de ese cliente: la fila de propiedad vigente
    // (RN-12). Un carro que vendio ya no es suyo y no aparece en su ficha.
    ...(filter.customerId === undefined
      ? {}
      : { owners: { some: { customerId: filter.customerId, isCurrent: true } } }),
  };
}
