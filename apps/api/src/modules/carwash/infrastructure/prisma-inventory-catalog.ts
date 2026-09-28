import type { InventoryItemOption } from '@elite/shared';
import { Injectable } from '@nestjs/common';
import { InventoryItemKind } from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { decimalToCents } from '../../../common/prisma/decimal';
import type {
  InventoryCatalog,
  InventoryProductRecord,
} from '../application/ports/inventory-catalog';

/** Tope del selector: un taller no vende cientos de productos a la vez. */
const OPTIONS_LIMIT = 200;

/**
 * Lo que el lavado lee del inventario (065): solo lectura, sin costos. Lo que
 * escribe existencias es el kardex (`inventory/infrastructure/stock-ledger`),
 * dentro de la transaccion del ticket.
 */
@Injectable()
export class PrismaInventoryCatalog implements InventoryCatalog {
  constructor(private readonly prisma: PrismaService) {}

  async findByIds(ids: readonly string[]): Promise<InventoryProductRecord[]> {
    if (ids.length === 0) return [];

    const rows = await this.prisma.inventoryItem.findMany({
      where: { id: { in: [...ids] } },
      select: {
        id: true,
        code: true,
        name: true,
        kind: true,
        isActive: true,
        price: true,
        taxRate: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      kind: row.kind,
      isActive: row.isActive,
      price: decimalToCents(row.price),
      taxRate: row.taxRate.toFixed(4),
    }));
  }

  async listOptions(search?: string): Promise<InventoryItemOption[]> {
    const where: Prisma.InventoryItemWhereInput = {
      kind: InventoryItemKind.PRODUCT,
      isActive: true,
      ...(search === undefined
        ? {}
        : {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
              { barcode: search },
            ],
          }),
    };

    const rows = await this.prisma.inventoryItem.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        price: true,
        unit: true,
        stockOnHand: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
      take: OPTIONS_LIMIT,
    });

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      price: row.price.toFixed(2),
      unit: row.unit,
      stockOnHand: row.stockOnHand.toFixed(3),
      category: row.category,
    }));
  }
}
