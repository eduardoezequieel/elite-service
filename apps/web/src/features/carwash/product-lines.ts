import type { InventoryItemOption, ProductTicketItemInput, TicketItem } from '@elite/shared';

import { centsToAmount, parseCents } from '@/lib/money';
import { milliToQuantity } from '@/lib/quantity';

/**
 * Productos del lavado (065): cantidades, totales por línea y la selección del
 * bloque «Productos» del alta y de la edición.
 *
 * Suelto y sin React por lo mismo que `pricing.ts`: que `2 × $3.00` dé `$6.00`,
 * que un producto no pase de lo que hay y que el cuerpo que viaja al API lleve
 * lo que tiene que llevar son reglas (RN-4, RN-6), no detalles de dibujo.
 *
 * Las cantidades viajan con tres decimales (`"2.000"`); acá adentro se cuentan
 * en **milésimas enteras** (`2000`) para no arrastrar los errores de un
 * `number` con coma flotante al multiplicar por centavos.
 */

/** Un paso del `− 1 +`, en milésimas. */
export const ONE_UNIT = 1000;

/** Milésimas enteras de una cantidad en cadena (`'2.500'` → `2500`). Ilegible = 0. */
export function toMilli(quantity: string): number {
  const clean = quantity.trim().replace(',', '.');

  if (!/^-?\d+(\.\d*)?$/.test(clean)) return 0;

  const negative = clean.startsWith('-');
  const [whole = '0', fraction = ''] = (negative ? clean.slice(1) : clean).split('.');
  const milli = Number(whole) * ONE_UNIT + Number(fraction.padEnd(3, '0').slice(0, 3));

  return negative ? -milli : milli;
}

/** La cantidad como se lee: sin ceros de relleno (`2000` → `'2'`, `1500` → `'1.5'`). */
export function quantityLabel(milli: number): string {
  return milliToQuantity(milli).replace(/0+$/, '').replace(/\.$/, '');
}

/**
 * La unidad en plural cuando la cantidad no es uno: «4 unidades», «2 galones».
 *
 * La unidad es texto libre del taller (RN-16), así que el plural es el de las
 * reglas generales y nada más: una abreviatura (`ml`, `kg`) o algo que no sea
 * una palabra se deja como vino, antes que inventarle una forma.
 */
export function unitLabel(unit: string, milli: number): string {
  const word = unit.trim();

  if (milli === ONE_UNIT || word.length < 3 || !/^[a-záéíóúñü]+$/i.test(word)) return word;
  if (/ón$/i.test(word)) return `${word.slice(0, -2)}ones`;
  if (/z$/i.test(word)) return `${word.slice(0, -1)}ces`;
  if (/[aeiouáéó]$/i.test(word)) return `${word}s`;

  return `${word}es`;
}

/** «4 unidades», «1 litro», «2.5 litros». Sin unidad, solo el número. */
export function quantityWithUnit(milli: number, unit: string): string {
  const label = unitLabel(unit, milli);

  return label === '' ? quantityLabel(milli) : `${quantityLabel(milli)} ${label}`;
}

/** Centavos de una línea: `unitPrice × quantity`, redondeado al centavo (RN-6). */
export function lineTotalCents(unitPrice: string, milli: number): number {
  return Math.round((parseCents(unitPrice) * milli) / ONE_UNIT);
}

/** La mitad izquierda de la fórmula: `2 × $3.00`. */
export function lineQuantityLabel(unitPrice: string, milli: number): string {
  return `${quantityLabel(milli)} × $${centsToAmount(parseCents(unitPrice))}`;
}

/** La línea de producto como se escribe en todas partes: `2 × $3.00 = $6.00`. */
export function lineFormula(unitPrice: string, milli: number): string {
  return `${lineQuantityLabel(unitPrice, milli)} = $${centsToAmount(lineTotalCents(unitPrice, milli))}`;
}

/** `true` si la línea es un producto del inventario y no un servicio. */
export function isProductLine(item: Pick<TicketItem, 'kind'>): boolean {
  return item.kind === 'PRODUCT';
}

/**
 * El nombre de una línea para un resumen de una sola fila (lista, tablero,
 * pista): el producto con más de una unidad lleva su `×2`.
 */
export function itemLabel(item: Pick<TicketItem, 'kind' | 'name' | 'quantity'>): string {
  const milli = toMilli(item.quantity);

  return isProductLine(item) && milli !== ONE_UNIT
    ? `${item.name} ×${quantityLabel(milli)}`
    : item.name;
}

/**
 * «2 servicios», «1 servicio · 2 productos», «1 combo · 1 servicio»: lo que
 * lleva un lavado, contado. Un combo cuenta una vez, no por sus líneas (104).
 */
export function linesCountLabel(
  items: readonly (Pick<TicketItem, 'kind'> & { comboId?: string | null })[],
): string {
  const loose = items.filter((item) => (item.comboId ?? null) === null);
  const combos = new Set(items.flatMap((item) => (item.comboId ? [item.comboId] : []))).size;
  const products = loose.filter(isProductLine).length;
  const services = loose.length - products;
  const parts: string[] = [];

  if (combos > 0) parts.push(`${combos} ${combos === 1 ? 'combo' : 'combos'}`);
  if (services > 0 || combos === 0) {
    parts.push(`${services} ${services === 1 ? 'servicio' : 'servicios'}`);
  }
  if (products > 0) parts.push(`${products} ${products === 1 ? 'producto' : 'productos'}`);

  return parts.join(' · ');
}

// --- la selección del bloque «Productos» ---

/** Un producto elegido en el alta o la edición, con su cantidad en milésimas. */
export interface ProductPick {
  inventoryItemId: string;
  name: string;
  /** El techo: el precio del artículo al agregarlo (RN-6, RN-7). */
  catalogPrice: string;
  /** Lo que se cobra por unidad. Igual al catálogo salvo que la línea ya viniera rebajada. */
  unitPrice: string;
  quantity: number;
}

/**
 * Los productos sueltos que el lavado ya tiene, leídos como selección. Una
 * línea sin `inventoryItemId` no se puede volver a pedir, así que no entra; la
 * de un combo tampoco: viaja con su combo, no en `items` (104).
 */
export function productsFromTicket(items: readonly TicketItem[]): ProductPick[] {
  return items.flatMap((item) =>
    isProductLine(item) && item.inventoryItemId !== null && item.comboId === null
      ? [
          {
            inventoryItemId: item.inventoryItemId,
            name: item.name,
            catalogPrice: item.catalogPrice,
            unitPrice: item.unitPrice,
            quantity: toMilli(item.quantity),
          },
        ]
      : [],
  );
}

/**
 * Lo que el lavado ya sacó del inventario, por artículo. En la edición eso ya
 * no está en `stockOnHand`: se puede volver a pedir sin que falte (RN-4).
 */
export function originalQuantities(items: readonly TicketItem[]): Record<string, number> {
  const totals: Record<string, number> = {};

  for (const pick of productsFromTicket(items)) {
    totals[pick.inventoryItemId] = (totals[pick.inventoryItemId] ?? 0) + pick.quantity;
  }

  return totals;
}

export function quantityOf(selection: readonly ProductPick[], inventoryItemId: string): number {
  return selection.find((pick) => pick.inventoryItemId === inventoryItemId)?.quantity ?? 0;
}

/**
 * Suma o resta al producto. Bajar a cero lo quita; subir uno que no estaba lo
 * agrega al final con el precio del artículo. Un producto va una sola vez, con
 * su cantidad (RN-9).
 */
export function stepProduct(
  selection: readonly ProductPick[],
  option: Pick<InventoryItemOption, 'id' | 'name' | 'price'>,
  delta: number,
): ProductPick[] {
  const current = selection.find((pick) => pick.inventoryItemId === option.id);

  if (current === undefined) {
    return delta > 0
      ? [
          ...selection,
          {
            inventoryItemId: option.id,
            name: option.name,
            catalogPrice: option.price,
            unitPrice: option.price,
            quantity: delta,
          },
        ]
      : [...selection];
  }

  const quantity = current.quantity + delta;

  return quantity <= 0
    ? selection.filter((pick) => pick !== current)
    : selection.map((pick) => (pick === current ? { ...pick, quantity } : pick));
}

/**
 * Lo que queda para seguir agregando: la existencia, más lo que este lavado ya
 * tenía apartado, menos lo que se está pidiendo ahora.
 */
export function availableAfter(stockOnHand: string, original: number, selected: number): number {
  return toMilli(stockOnHand) + original - selected;
}

/** Centavos de todos los productos elegidos. */
export function productsTotalCents(selection: readonly ProductPick[]): number {
  return selection.reduce((sum, pick) => sum + lineTotalCents(pick.unitPrice, pick.quantity), 0);
}

/**
 * Las líneas de producto del cuerpo que viaja al API. El precio solo va si se
 * apartó del catálogo: si no, lo pone el API con el precio del artículo.
 */
export function productItemsPayload(selection: readonly ProductPick[]): ProductTicketItemInput[] {
  return selection
    .filter((pick) => pick.quantity > 0)
    .map((pick) => ({
      inventoryItemId: pick.inventoryItemId,
      quantity: milliToQuantity(pick.quantity),
      ...(parseCents(pick.unitPrice) === parseCents(pick.catalogPrice)
        ? {}
        : { unitPrice: pick.unitPrice }),
    }));
}

/**
 * Una firma de los productos del lavado: cambia si cambia un artículo, su
 * cantidad o su precio. Sirve para saber si hay algo sin guardar y para
 * adoptar lo que llegó por el hilo.
 */
export function productSignature(selection: readonly ProductPick[]): string {
  return selection
    .map((pick) => `${pick.inventoryItemId}:${pick.quantity}:${parseCents(pick.unitPrice)}`)
    .sort()
    .join('|');
}

/** El faltante que el API devolvió con `409 INSUFFICIENT_STOCK`. */
export interface StockShortage {
  itemId: string;
  /** Lo que hay, en milésimas. */
  available: number;
}

/**
 * Lee `details: { itemId, available }` de un `409 INSUFFICIENT_STOCK`. Todo lo
 * que no tenga esa forma no es un faltante que se pueda marcar en una línea.
 */
export function stockShortageOf(
  error: { code: string; details?: unknown } | null | undefined,
): StockShortage | null {
  if (error?.code !== 'INSUFFICIENT_STOCK') return null;

  const details = error.details;

  if (typeof details !== 'object' || details === null) return null;

  const { itemId, available } = details as { itemId?: unknown; available?: unknown };

  if (typeof itemId !== 'string') return null;
  if (typeof available === 'string') return { itemId, available: toMilli(available) };
  if (typeof available === 'number' && Number.isFinite(available)) {
    return { itemId, available: Math.round(available * ONE_UNIT) };
  }

  return null;
}

/**
 * El faltante sigue marcado mientras lo pedido pase de lo que hay: al bajar la
 * cantidad se apaga solo, sin esperar a volver a guardar.
 */
export function activeShortage(
  shortage: StockShortage | null,
  selection: readonly ProductPick[],
): StockShortage | null {
  if (shortage === null) return null;

  return quantityOf(selection, shortage.itemId) > shortage.available ? shortage : null;
}
