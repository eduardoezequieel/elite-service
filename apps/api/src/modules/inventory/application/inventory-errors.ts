import { API_ERROR_CODES } from '@elite/shared';

import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../common/errors/application-error';
import {
  BarcodeTakenError,
  CategoryKindMismatchError,
  CategoryNameTakenError,
  ProductPriceRequiredError,
  SupplyHasPriceError,
} from '../domain/inventory-item';
import {
  fromQuantityString,
  InsufficientStockError,
  InventoryItemNotFoundError,
  ItemInactiveError,
  ItemNotDispatchableError,
  ItemNotSellableError,
} from '../domain/stock';

/** `"1.000"` → `"1"`, `"0.500"` → `"0.5"`: como lo dice la UI («Hay 1»). */
function spoken(quantity: string): string {
  const milli = fromQuantityString(quantity);
  const whole = Math.trunc(milli / 1000);
  const fraction = Math.abs(milli % 1000);

  return fraction === 0
    ? String(whole)
    : `${whole}.${String(fraction).padStart(3, '0').replace(/0+$/, '')}`;
}

/**
 * Traduce un error del dominio del inventario al `ApplicationError` del contrato
 * `{ code, message, details? }` (065, 084). El status lo pone `AllExceptionsFilter`.
 * Lo que no reconoce lo devuelve tal cual.
 *
 * Lo usan el inventario, el lavado y la venta suelta: los tres escriben
 * existencias con `recordStockMovement`, y el mismo `INSUFFICIENT_STOCK` tiene
 * que salir igual de los tres.
 *
 * @example
 * ```ts
 * try { ... } catch (error) { throw toInventoryError(error); }
 * ```
 */
export function toInventoryError(error: unknown): unknown {
  if (error instanceof InsufficientStockError) {
    return new ConflictError({
      code: API_ERROR_CODES.INSUFFICIENT_STOCK,
      message: `No alcanza la existencia. Hay ${spoken(error.available)}.`,
      details: { itemId: error.itemId, available: error.available },
    });
  }

  if (error instanceof ItemInactiveError) {
    return new ConflictError({
      code: API_ERROR_CODES.ITEM_INACTIVE,
      message: 'Ese artículo está desactivado.',
      details: { itemId: error.itemId },
    });
  }

  if (error instanceof ItemNotSellableError) {
    return new ConflictError({
      code: API_ERROR_CODES.ITEM_NOT_SELLABLE,
      message: 'Ese artículo es un insumo: no se vende.',
      details: { itemId: error.itemId },
    });
  }

  if (error instanceof ItemNotDispatchableError) {
    return new ConflictError({
      code: API_ERROR_CODES.ITEM_NOT_DISPATCHABLE,
      message: 'Ese artículo es un producto: no se despacha. Anotalo en una cuenta abierta.',
      details: { itemId: error.itemId },
    });
  }

  if (error instanceof InventoryItemNotFoundError) {
    return new NotFoundError({
      code: API_ERROR_CODES.NOT_FOUND,
      message: 'Ese artículo no existe.',
      details: { itemId: error.itemId },
    });
  }

  if (error instanceof BarcodeTakenError) {
    return new ConflictError({
      code: API_ERROR_CODES.BARCODE_TAKEN,
      message: 'Otro artículo ya tiene ese código de barras.',
      details: { barcode: error.barcode },
    });
  }

  if (error instanceof CategoryNameTakenError) {
    return new ConflictError({
      code: API_ERROR_CODES.CATEGORY_NAME_TAKEN,
      message: 'Ya existe una categoría con ese nombre.',
      details: { name: error.categoryName },
    });
  }

  if (error instanceof CategoryKindMismatchError) {
    const message =
      error.itemKind === 'PRODUCT'
        ? 'Esa categoría es de insumos: elegí una de productos.'
        : 'Esa categoría es de productos: elegí una de insumos.';

    return new ValidationError({
      code: API_ERROR_CODES.CATEGORY_KIND_MISMATCH,
      message,
      details: { categoryId: message },
    });
  }

  if (error instanceof SupplyHasPriceError) {
    return new BadRequestError({
      code: API_ERROR_CODES.SUPPLY_HAS_PRICE,
      message: 'Un insumo no lleva precio de venta.',
    });
  }

  if (error instanceof ProductPriceRequiredError) {
    return new ValidationError({
      code: API_ERROR_CODES.VALIDATION_ERROR,
      message: 'Un producto necesita un precio mayor que cero.',
      details: { price: 'Un producto necesita un precio mayor que cero.' },
    });
  }

  return error;
}

/** Corre `work` y traduce sus errores de inventario. */
export async function withInventoryErrors<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw toInventoryError(error);
  }
}
