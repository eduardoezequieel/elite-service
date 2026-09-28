/**
 * Reglas del artículo que no son de existencia (065 RN-1, RN-13, RN-15).
 */
import type { Cents } from './cost';
import type { Milli } from './stock';

export type ItemKind = 'PRODUCT' | 'SUPPLY';

/** Se mandó precio mayor que cero para un insumo (RN-1). */
export class SupplyHasPriceError extends Error {
  constructor() {
    super('A supply cannot have a sale price');
    this.name = 'SupplyHasPriceError';
  }
}

/** Un producto sin precio no se puede vender (RN-1). */
export class ProductPriceRequiredError extends Error {
  constructor() {
    super('A product needs a price greater than zero');
    this.name = 'ProductPriceRequiredError';
  }
}

/** Otro artículo ya tiene ese código de barras (RN-15). */
export class BarcodeTakenError extends Error {
  constructor(readonly barcode: string) {
    super('Barcode already in use');
    this.name = 'BarcodeTakenError';
  }
}

/** Ya existe una categoría de inventario con ese nombre. */
export class CategoryNameTakenError extends Error {
  constructor(readonly categoryName: string) {
    super('Inventory category name already in use');
    this.name = 'CategoryNameTakenError';
  }
}

/** La categoría es de otro tipo que el artículo (072). */
export class CategoryKindMismatchError extends Error {
  constructor(
    readonly categoryId: string,
    readonly itemKind: ItemKind,
  ) {
    super('Inventory category belongs to the other item kind');
    this.name = 'CategoryKindMismatchError';
  }
}

/**
 * El precio que se guarda (RN-1): un producto lo exige mayor que cero; un
 * insumo lo guarda en cero y rechaza cualquier otro.
 *
 * @param price `undefined` = no vino en el request.
 * @throws SupplyHasPriceError, ProductPriceRequiredError.
 */
export function resolveItemPrice(kind: ItemKind, price: Cents | undefined): Cents {
  if (kind === 'SUPPLY') {
    if (price !== undefined && price > 0) throw new SupplyHasPriceError();

    return 0;
  }

  if (price === undefined || price <= 0) throw new ProductPriceRequiredError();

  return price;
}

/** En o bajo el mínimo (RN-13). Sin mínimo (`0`) nunca está bajo. */
export function isLowStock(onHand: Milli, minStock: Milli): boolean {
  return minStock > 0 && onHand <= minStock;
}

/**
 * El `lowStockNotified` tras cambiar el mínimo a mano.
 *
 * Si la existencia queda por encima del mínimo nuevo, el aviso se rearma. Si
 * queda en o bajo, se conserva lo que había: el aviso lo dispara un movimiento
 * (RN-13), no editar la ficha, así que el siguiente movimiento que la deje en o
 * bajo el mínimo avisa si todavía no se había avisado.
 */
export function lowStockFlagAfterMinChange(
  onHand: Milli,
  minStock: Milli,
  notified: boolean,
): boolean {
  return isLowStock(onHand, minStock) ? notified : false;
}
