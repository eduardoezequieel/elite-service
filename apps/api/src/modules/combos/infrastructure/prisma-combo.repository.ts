import type { Page } from '@elite/shared';
import { Injectable } from '@nestjs/common';
import {
  BusinessArea,
  ComboPricingMode,
  InventoryItemKind,
  Prisma,
  WorkOrderItemKind,
} from '@prisma/client';

import { pageOf, skipTake } from '../../../common/pagination/page';
import { civilToDate, dateToCivil } from '../../../common/prisma/date-column';
import { decimalToCents, decimalToMilli } from '../../../common/prisma/decimal';
import { lastSequence, retryOnSequenceClash } from '../../../common/prisma/last-sequence';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { toDecimalString } from '../../carwash/domain/money';
import { COMBO_PREFIX, nextNumber } from '../../carwash/domain/numbering';
import type {
  ComboPageFilter,
  ComboRecord,
  ComboRepository,
  ComboWriteData,
  ComponentSource,
} from '../application/ports/combo.repository';

/** Milésimas por unidad: la cantidad de un componente es entera (RN-1). */
const MILLI_PER_UNIT = 1000;

const COMBO_INCLUDE = {
  prices: true,
  items: {
    orderBy: { sortOrder: 'asc' },
    include: {
      service: { include: { prices: true } },
      inventoryItem: true,
    },
  },
} satisfies Prisma.ComboInclude;

type ComboRow = Prisma.ComboGetPayload<{ include: typeof COMBO_INCLUDE }>;

const ORDER: Prisma.ComboOrderByWithRelationInput[] = [{ name: 'asc' }, { id: 'asc' }];

function toRecord(row: ComboRow): ComboRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    pricingMode: row.pricingMode,
    discountPercent: row.discountPercent,
    validFrom: dateToCivil(row.validFrom) ?? '',
    validTo: dateToCivil(row.validTo),
    weekdays: [...row.weekdays].sort((a, b) => a - b),
    isActive: row.isActive,
    fixedPrices: row.prices.map((price) => ({
      bodyTypeId: price.bodyTypeId,
      price: decimalToCents(price.price),
    })),
    components: row.items.map((item) => {
      const quantity = decimalToMilli(item.quantity) / MILLI_PER_UNIT;

      if (item.service !== null) {
        return {
          kind: 'SERVICE' as const,
          serviceId: item.service.id,
          inventoryItemId: null,
          code: item.service.code,
          name: item.service.name,
          taxRate: item.service.taxRate.toFixed(4),
          quantity: 1,
          defaultPrice: decimalToCents(item.service.defaultPrice),
          prices: item.service.prices.map((price) => ({
            bodyTypeId: price.bodyTypeId,
            price: decimalToCents(price.price),
          })),
          stockOnHand: null,
        };
      }

      if (item.inventoryItem === null) {
        throw new Error(`Combo item ${item.id} has neither service nor product`);
      }

      return {
        kind: 'PRODUCT' as const,
        serviceId: null,
        inventoryItemId: item.inventoryItem.id,
        code: item.inventoryItem.code,
        name: item.inventoryItem.name,
        taxRate: item.inventoryItem.taxRate.toFixed(4),
        quantity,
        defaultPrice: decimalToCents(item.inventoryItem.price),
        prices: [],
        stockOnHand: decimalToMilli(item.inventoryItem.stockOnHand),
      };
    }),
  };
}

/**
 * El estado de RN-3 como `where`, con el día de hoy: `PAUSED` = inactivo;
 * `SCHEDULED` = activo y empieza después; `EXPIRED` = activo y terminó antes;
 * `LIVE` = activo con hoy adentro (sin fin cuenta como adentro).
 */
function statusWhere(status: ComboPageFilter['status'], today: Date): Prisma.ComboWhereInput {
  switch (status) {
    case undefined:
      return {};
    case 'PAUSED':
      return { isActive: false };
    case 'SCHEDULED':
      return { isActive: true, validFrom: { gt: today } };
    case 'EXPIRED':
      return { isActive: true, validTo: { lt: today } };
    case 'LIVE':
      return liveWhere(today);
  }
}

function liveWhere(today: Date): Prisma.ComboWhereInput {
  return {
    isActive: true,
    validFrom: { lte: today },
    OR: [{ validTo: null }, { validTo: { gte: today } }],
  };
}

/** Las columnas del combo y sus hijos, para el alta y la edición. */
function childRows(data: ComboWriteData) {
  return {
    items: data.items.map((item, index) => ({
      kind: item.kind === 'PRODUCT' ? WorkOrderItemKind.PRODUCT : WorkOrderItemKind.SERVICE,
      serviceId: item.serviceId,
      inventoryItemId: item.inventoryItemId,
      quantity: String(item.quantity),
      sortOrder: index,
    })),
    prices: data.prices.map((row) => ({
      bodyTypeId: row.bodyTypeId,
      price: toDecimalString(row.price),
    })),
  };
}

function comboColumns(data: ComboWriteData) {
  return {
    name: data.name,
    pricingMode: data.pricingMode === 'PERCENT' ? ComboPricingMode.PERCENT : ComboPricingMode.FIXED,
    discountPercent: data.discountPercent,
    validFrom: civilToDate(data.validFrom),
    validTo: data.validTo === null ? null : civilToDate(data.validTo),
    weekdays: data.weekdays,
    isActive: data.isActive,
  };
}

@Injectable()
export class PrismaComboRepository implements ComboRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPage(filter: ComboPageFilter): Promise<Page<ComboRecord>> {
    const where: Prisma.ComboWhereInput = {
      AND: [
        statusWhere(filter.status, civilToDate(filter.today)),
        filter.search === undefined
          ? {}
          : {
              OR: [
                { name: { contains: filter.search, mode: 'insensitive' } },
                { code: { contains: filter.search, mode: 'insensitive' } },
              ],
            },
      ],
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.combo.findMany({
        where,
        orderBy: ORDER,
        include: COMBO_INCLUDE,
        ...skipTake(filter),
      }),
      this.prisma.combo.count({ where }),
    ]);

    return pageOf(rows.map(toRecord), total, filter);
  }

  async findById(id: string): Promise<ComboRecord | null> {
    const row = await this.prisma.combo.findUnique({ where: { id }, include: COMBO_INCLUDE });

    return row === null ? null : toRecord(row);
  }

  async findByIds(ids: readonly string[]): Promise<ComboRecord[]> {
    if (ids.length === 0) return [];

    const rows = await this.prisma.combo.findMany({
      where: { id: { in: [...ids] } },
      orderBy: ORDER,
      include: COMBO_INCLUDE,
    });

    return rows.map(toRecord);
  }

  async listLive(today: string): Promise<ComboRecord[]> {
    const rows = await this.prisma.combo.findMany({
      where: liveWhere(civilToDate(today)),
      orderBy: ORDER,
      include: COMBO_INCLUDE,
    });

    return rows.map(toRecord);
  }

  async findIdByName(name: string): Promise<string | null> {
    const row = await this.prisma.combo.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });

    return row?.id ?? null;
  }

  async findServices(ids: readonly string[]): Promise<ComponentSource[]> {
    if (ids.length === 0) return [];

    const rows = await this.prisma.service.findMany({
      where: { id: { in: [...ids] }, area: BusinessArea.CARWASH },
      include: { prices: true },
    });

    return rows.map((row) => ({
      kind: 'SERVICE',
      id: row.id,
      code: row.code,
      name: row.name,
      taxRate: row.taxRate.toFixed(4),
      isActive: row.isActive,
      sellable: true,
      defaultPrice: decimalToCents(row.defaultPrice),
      prices: row.prices.map((price) => ({
        bodyTypeId: price.bodyTypeId,
        price: decimalToCents(price.price),
      })),
      stockOnHand: null,
    }));
  }

  async findProducts(ids: readonly string[]): Promise<ComponentSource[]> {
    if (ids.length === 0) return [];

    const rows = await this.prisma.inventoryItem.findMany({ where: { id: { in: [...ids] } } });

    return rows.map((row) => ({
      kind: 'PRODUCT',
      id: row.id,
      code: row.code,
      name: row.name,
      taxRate: row.taxRate.toFixed(4),
      isActive: row.isActive,
      sellable: row.kind === InventoryItemKind.PRODUCT,
      defaultPrice: decimalToCents(row.price),
      prices: [],
      stockOnHand: decimalToMilli(row.stockOnHand),
    }));
  }

  async listActiveBodyTypeIds(): Promise<string[]> {
    const rows = await this.prisma.vehicleBodyType.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });

    return rows.map((row) => row.id);
  }

  /** El código `CMB-0001` se saca e inserta en la misma transacción; un choque reintenta (073). */
  async create(data: ComboWriteData): Promise<ComboRecord> {
    const children = childRows(data);
    const row = await retryOnSequenceClash('combos', () =>
      this.prisma.$transaction(async (tx) => {
        const last = await lastSequence(tx, 'combos', COMBO_PREFIX);

        return tx.combo.create({
          data: {
            code: nextNumber(COMBO_PREFIX, last),
            ...comboColumns(data),
            items: { create: children.items },
            prices: { create: children.prices },
          },
          include: COMBO_INCLUDE,
        });
      }),
    );

    return toRecord(row);
  }

  /** Componentes y precios se reemplazan enteros: llegan como el estado completo. */
  async update(id: string, data: ComboWriteData): Promise<ComboRecord> {
    const children = childRows(data);
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.comboItem.deleteMany({ where: { comboId: id } });
      await tx.comboPrice.deleteMany({ where: { comboId: id } });

      return tx.combo.update({
        where: { id },
        data: {
          ...comboColumns(data),
          items: { create: children.items },
          prices: { create: children.prices },
        },
        include: COMBO_INCLUDE,
      });
    });

    return toRecord(row);
  }
}
