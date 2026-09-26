import type { Cents } from '../../carwash/domain/money';
import type { Milli } from '../../inventory/domain/stock';

/**
 * La venta suelta (065 RN-18 a RN-22): reglas puras, sin Nest ni Prisma.
 *
 * Lo que decide este modulo es **que se vende y a cuanto**: que cada linea sea
 * un producto activo, que el precio no pase el del articulo y cuanto suma. El
 * cobro (suma exacta, vuelto) lo decide el dominio de la 059, que es el mismo
 * para un lavado y para una venta.
 */

/** Serie propia de la venta suelta: `V-0001`. */
export const SALE_PREFIX = 'V';

const MILLI_PER_UNIT = 1000;

/** Lo que la venta necesita saber de un articulo del inventario. */
export interface SaleCatalogItem {
  id: string;
  code: string;
  name: string;
  kind: 'PRODUCT' | 'SUPPLY';
  isActive: boolean;
  /** Precio de venta del articulo: techo del precio unitario (RN-21). */
  price: Cents;
  /** `Decimal(6, 4)` tal cual, para el snapshot. */
  taxRate: string;
}

/** Una linea pedida, ya traducida a enteros. `unitPrice` null = el del articulo. */
export interface RequestedSaleLine {
  inventoryItemId: string;
  quantity: Milli;
  unitPrice: Cents | null;
}

/** Una linea con precio resuelto, lista para guardarse como snapshot (RN-6). */
export interface PricedSaleLine {
  item: SaleCatalogItem;
  quantity: Milli;
  catalogPrice: Cents;
  unitPrice: Cents;
  total: Cents;
  /** Precio por debajo del articulo: pide la firma de la 060 (RN-21). */
  discounted: boolean;
}

/** Por que una linea no se puede vender. */
export type SaleLineRejection =
  | { reason: 'NOT_FOUND'; itemId: string }
  | { reason: 'INACTIVE'; itemId: string }
  | { reason: 'NOT_SELLABLE'; itemId: string }
  | { reason: 'ABOVE_CATALOG'; itemId: string; catalogPrice: Cents };

export type SaleLinesResult =
  { ok: true; lines: PricedSaleLine[] } | { ok: false; rejection: SaleLineRejection };

/**
 * `unitPrice × quantity`, en centavos, redondeado a medio centavo hacia arriba.
 *
 * Todo es entero: `$1.50 × 2.500` es `150 × 2500 / 1000 = 375`. El redondeo
 * solo aparece con cantidades fraccionarias (medio litro de algo de $3.33).
 */
export function saleLineTotal(unitPrice: Cents, quantity: Milli): Cents {
  return Math.floor((unitPrice * quantity + MILLI_PER_UNIT / 2) / MILLI_PER_UNIT);
}

/**
 * Resuelve precio y total de cada linea contra el catalogo (RN-21).
 *
 * - El articulo tiene que existir, estar activo y ser `PRODUCT`: un insumo no
 *   se vende. Se mira activo antes que tipo, igual que el kardex.
 * - Sin precio pedido se cobra el del articulo; con precio, `0 <= precio <=
 *   articulo`. Cobrar de mas no se autoriza: se corrige en el catalogo.
 *
 * Se detiene en la primera linea mala: la venta es todo o nada (RN-19).
 */
export function priceSaleLines(
  requested: readonly RequestedSaleLine[],
  catalog: readonly SaleCatalogItem[],
): SaleLinesResult {
  const byId = new Map(catalog.map((item) => [item.id, item]));
  const lines: PricedSaleLine[] = [];

  for (const line of requested) {
    const item = byId.get(line.inventoryItemId);

    if (item === undefined) {
      return { ok: false, rejection: { reason: 'NOT_FOUND', itemId: line.inventoryItemId } };
    }

    if (!item.isActive) {
      return { ok: false, rejection: { reason: 'INACTIVE', itemId: item.id } };
    }

    if (item.kind !== 'PRODUCT') {
      return { ok: false, rejection: { reason: 'NOT_SELLABLE', itemId: item.id } };
    }

    const unitPrice = line.unitPrice ?? item.price;

    if (unitPrice > item.price) {
      return {
        ok: false,
        rejection: { reason: 'ABOVE_CATALOG', itemId: item.id, catalogPrice: item.price },
      };
    }

    lines.push({
      item,
      quantity: line.quantity,
      catalogPrice: item.price,
      unitPrice,
      total: saleLineTotal(unitPrice, line.quantity),
      discounted: unitPrice < item.price,
    });
  }

  return { ok: true, lines };
}

/** Alguna linea baja del precio del articulo: la venta pide firma (RN-21). */
export function needsPriceAuthorization(lines: readonly PricedSaleLine[]): boolean {
  return lines.some((line) => line.discounted);
}

/**
 * Si la venta todavia se puede anular (RN-22): cobrada y con **todos** sus
 * pagos en el turno abierto. La caja de un turno cerrado ya cuadro, y una
 * venta sin pagos no tiene nada que sacar del turno.
 */
export function isSaleVoidable(
  status: 'PAID' | 'VOID',
  paymentSessions: readonly { isOpen: boolean }[],
): boolean {
  return (
    status === 'PAID' &&
    paymentSessions.length > 0 &&
    paymentSessions.every((session) => session.isOpen)
  );
}

/** Quien firmo un precio por debajo del articulo (060) y por que. */
export interface SalePriceSignature {
  userId: string;
  reason: string;
}

/**
 * Una linea lista para guardarse: el snapshot del articulo al venderlo (RN-6)
 * y, si bajo del precio, la firma. Es lo que escribe la venta, sola o dentro de
 * una cuenta con lavados (066).
 */
export interface SaleLineSnapshot {
  inventoryItemId: string;
  code: string;
  name: string;
  catalogPrice: Cents;
  unitPrice: Cents;
  quantity: Milli;
  taxRate: string;
  priceAuthorizedByUserId: string | null;
  priceReason: string | null;
}

/** La firma queda solo en las lineas rebajadas: las demas van a precio de catalogo. */
export function snapshotSaleLine(
  line: PricedSaleLine,
  signer: SalePriceSignature | null,
): SaleLineSnapshot {
  const signed = line.discounted && signer !== null;

  return {
    inventoryItemId: line.item.id,
    code: line.item.code,
    name: line.item.name,
    catalogPrice: line.catalogPrice,
    unitPrice: line.unitPrice,
    quantity: line.quantity,
    taxRate: line.item.taxRate,
    priceAuthorizedByUserId: signed ? signer.userId : null,
    priceReason: signed ? signer.reason : null,
  };
}
