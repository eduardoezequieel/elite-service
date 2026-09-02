import type { ServiceCategorySummary, ServiceDetail } from '@elite/shared';
import { Injectable } from '@nestjs/common';
import { BusinessArea } from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { SERVICE_PREFIX, nextNumber } from '../../carwash/domain/numbering';
import type {
  CategoryChanges,
  NewCategoryData,
  NewServiceData,
  ServiceCatalogRepository,
  ServiceChanges,
} from '../application/ports/service-catalog.repository';

/** Esta spec solo trabaja el area de lavado (RN-1). */
const AREA = BusinessArea.CARWASH;

const INCLUDE = { category: true, prices: true } satisfies Prisma.ServiceInclude;
type ServiceRow = Prisma.ServiceGetPayload<{ include: typeof INCLUDE }>;

function toCategory(row: {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}): ServiceCategorySummary {
  return { id: row.id, name: row.name, sortOrder: row.sortOrder, isActive: row.isActive };
}

function toService(row: ServiceRow): ServiceDetail {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: toCategory(row.category),
    // `Decimal` se serializa a cadena: el contrato lleva dinero como texto para
    // que no pase por un `number` de JavaScript en ningun tramo.
    defaultPrice: row.defaultPrice.toFixed(2),
    taxRate: row.taxRate.toFixed(4),
    isActive: row.isActive,
    prices: row.prices.map((price) => ({
      bodyTypeId: price.bodyTypeId,
      price: price.price.toFixed(2),
    })),
  };
}

@Injectable()
export class PrismaServiceCatalogRepository implements ServiceCatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories(): Promise<ServiceCategorySummary[]> {
    const rows = await this.prisma.serviceCategory.findMany({
      where: { area: AREA },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return rows.map(toCategory);
  }

  async findCategoryById(id: string): Promise<ServiceCategorySummary | null> {
    const row = await this.prisma.serviceCategory.findFirst({ where: { id, area: AREA } });

    return row === null ? null : toCategory(row);
  }

  async categoryExists(id: string): Promise<boolean> {
    const found = await this.prisma.serviceCategory.findFirst({
      where: { id, area: AREA, isActive: true },
      select: { id: true },
    });

    return found !== null;
  }

  async createCategory(data: NewCategoryData): Promise<ServiceCategorySummary> {
    return toCategory(await this.prisma.serviceCategory.create({ data: { ...data, area: AREA } }));
  }

  async updateCategory(id: string, changes: CategoryChanges): Promise<ServiceCategorySummary> {
    return toCategory(await this.prisma.serviceCategory.update({ where: { id }, data: changes }));
  }

  async listServices(onlyActive = false): Promise<ServiceDetail[]> {
    const rows = await this.prisma.service.findMany({
      where: { area: AREA, ...(onlyActive ? { isActive: true } : {}) },
      orderBy: [{ category: { sortOrder: 'asc' } }, { code: 'asc' }],
      include: INCLUDE,
    });

    return rows.map(toService);
  }

  async findServiceById(id: string): Promise<ServiceDetail | null> {
    const row = await this.prisma.service.findFirst({
      where: { id, area: AREA },
      include: INCLUDE,
    });

    return row === null ? null : toService(row);
  }

  /**
   * El codigo (`SRV-0004`) se calcula y se inserta dentro de la misma
   * transaccion, y la columna es unica: dos altas simultaneas chocan en la base
   * en vez de repetir codigo (RN-15).
   */
  async createService(data: NewServiceData): Promise<ServiceDetail> {
    const row = await this.prisma.$transaction(async (tx) => {
      const last = await tx.service.findFirst({
        orderBy: { code: 'desc' },
        select: { code: true },
      });

      return tx.service.create({
        data: {
          code: nextNumber(SERVICE_PREFIX, last?.code ?? null),
          name: data.name,
          categoryId: data.categoryId,
          area: AREA,
          defaultPrice: data.defaultPrice,
          prices: { create: data.prices },
        },
        include: INCLUDE,
      });
    });

    return toService(row);
  }

  async updateService(id: string, changes: ServiceChanges): Promise<ServiceDetail> {
    const { prices, ...fields } = changes;

    const row = await this.prisma.$transaction(async (tx) => {
      if (prices !== undefined) {
        // La matriz se reemplaza entera: llega como el estado completo que la
        // pantalla quiere dejar, no como un parche.
        await tx.servicePrice.deleteMany({ where: { serviceId: id } });

        if (prices.length > 0) {
          await tx.servicePrice.createMany({
            data: prices.map((price) => ({ serviceId: id, ...price })),
          });
        }
      }

      return tx.service.update({ where: { id }, data: fields, include: INCLUDE });
    });

    return toService(row);
  }
}
