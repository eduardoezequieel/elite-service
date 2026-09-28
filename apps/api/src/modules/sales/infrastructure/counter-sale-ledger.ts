import type { InventoryLowStockPayload } from '@elite/shared';
import type { Prisma } from '@prisma/client';

import { lastSequence } from '../../../common/prisma/last-sequence';
import { decimalToMilli } from '../../../common/prisma/decimal';
import { toDecimalString, type Cents } from '../../carwash/domain/money';
import { nextNumber } from '../../carwash/domain/numbering';
import { toQuantityString } from '../../inventory/domain/stock';
import { recordStockMovement } from '../../inventory/infrastructure/stock-ledger';
import { SALE_PREFIX, type SaleLineSnapshot } from '../domain/counter-sale';

/**
 * Lo que la venta suelta escribe **dentro de la transaccion de otro** (066).
 *
 * La venta no tiene transaccion propia: nace y muere con su cuenta de la 059,
 * que puede llevar ademas lavados. Quien abre la transaccion es la cuenta
 * (`carwash/infrastructure/prisma-charge.repository.ts`), y aca vive lo que
 * solo sabe la venta —su correlativo, sus lineas, su salida y su vuelta al
 * kardex—, para que no se escriba en dos lugares. Los pagos no: los reparte y
 * los escribe la cuenta, porque son de la cuenta (059 RN-5).
 */

export interface CounterSaleWrite {
  chargeId: string;
  customerName: string | null;
  total: Cents;
  lines: readonly SaleLineSnapshot[];
  userId: string;
}

export interface CounterSaleWritten {
  saleId: string;
  /** Avisos de minimo para publicar tras el commit (065 RN-13). */
  lowStock: InventoryLowStockPayload[];
}

/**
 * La venta y sus lineas, con un `SALE` por linea en el kardex (065 RN-19). Si
 * una linea no tiene existencia, el kardex lanza y la transaccion entera se
 * deshace: no se vende ni se cobra nada.
 */
export async function writeCounterSale(
  tx: Prisma.TransactionClient,
  data: CounterSaleWrite,
): Promise<CounterSaleWritten> {
  // Por largo y despues por texto (073). Un choque en el unique lo reintenta
  // la cuenta, que es la duena de la transaccion.
  const last = await lastSequence(tx, 'counter_sales', SALE_PREFIX);
  const sale = await tx.counterSale.create({
    data: {
      number: nextNumber(SALE_PREFIX, last),
      customerName: data.customerName,
      total: toDecimalString(data.total),
      chargeId: data.chargeId,
      createdByUserId: data.userId,
    },
    select: { id: true },
  });

  await tx.counterSaleItem.createMany({
    data: data.lines.map((line, index) => ({
      counterSaleId: sale.id,
      inventoryItemId: line.inventoryItemId,
      code: line.code,
      name: line.name,
      catalogPrice: toDecimalString(line.catalogPrice),
      unitPrice: toDecimalString(line.unitPrice),
      quantity: toQuantityString(line.quantity),
      taxRate: line.taxRate,
      priceAuthorizedByUserId: line.priceAuthorizedByUserId,
      priceReason: line.priceReason,
      sortOrder: index,
    })),
  });

  const lowStock: InventoryLowStockPayload[] = [];

  for (const line of data.lines) {
    const result = await recordStockMovement(tx, {
      itemId: line.inventoryItemId,
      type: 'SALE',
      quantity: -line.quantity,
      counterSaleId: sale.id,
      createdByUserId: data.userId,
      requireActive: true,
      requireSellable: true,
    });

    if (result.lowStock !== null) lowStock.push(result.lowStock);
  }

  return { saleId: sale.id, lowStock };
}

export interface CounterSaleVoid {
  reason: string;
  voidedByUserId: string | null;
  userId: string | null;
}

/**
 * Anula la venta de una cuenta (065 RN-22, 066): queda `VOID` firmada, suelta
 * de la cuenta —que se borra despues— y cada linea vuelve al inventario con un
 * `SALE_RETURN`. La venta no se borra: el kardex la referencia.
 *
 * Devuelve `null` si la cuenta no tenia venta. Bloquea la fila: dos
 * anulaciones simultaneas no devuelven dos veces.
 */
export async function voidCounterSaleOfCharge(
  tx: Prisma.TransactionClient,
  chargeId: string,
  data: CounterSaleVoid,
): Promise<CounterSaleWritten | null> {
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM counter_sales
    WHERE "chargeId" = ${chargeId}::uuid AND status = 'PAID'
    FOR UPDATE
  `;
  const saleId = locked[0]?.id;

  if (saleId === undefined) return null;

  await tx.counterSale.update({
    where: { id: saleId },
    data: {
      status: 'VOID',
      chargeId: null,
      voidedByUserId: data.voidedByUserId,
      voidedAt: new Date(),
      voidReason: data.reason,
    },
  });

  const items = await tx.counterSaleItem.findMany({
    where: { counterSaleId: saleId },
    orderBy: { sortOrder: 'asc' },
    select: { inventoryItemId: true, quantity: true },
  });
  const lowStock: InventoryLowStockPayload[] = [];

  for (const item of items) {
    const result = await recordStockMovement(tx, {
      itemId: item.inventoryItemId,
      type: 'SALE_RETURN',
      quantity: decimalToMilli(item.quantity),
      counterSaleId: saleId,
      createdByUserId: data.userId,
    });

    if (result.lowStock !== null) lowStock.push(result.lowStock);
  }

  return { saleId, lowStock };
}
