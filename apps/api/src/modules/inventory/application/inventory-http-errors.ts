import { API_ERROR_CODES } from '@elite/shared';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import {
  BarcodeTakenError,
  CategoryNameTakenError,
  ProductPriceRequiredError,
  SupplyHasPriceError,
} from '../domain/inventory-item';
import {
  fromQuantityString,
  InsufficientStockError,
  InventoryItemNotFoundError,
  ItemInactiveError,
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
 * Traduce un error del dominio del inventario a la excepción HTTP del contrato
 * `{ code, message, details? }` (065). Lo que no reconoce lo devuelve tal cual.
 *
 * Lo usan el inventario, el lavado y la venta suelta: los tres escriben
 * existencias con `recordStockMovement`, y el mismo `INSUFFICIENT_STOCK` tiene
 * que salir igual de los tres.
 *
 * @example
 * ```ts
 * try { ... } catch (error) { throw toInventoryHttpError(error); }
 * ```
 */
export function toInventoryHttpError(error: unknown): unknown {
  if (error instanceof InsufficientStockError) {
    return new ConflictException({
      code: API_ERROR_CODES.INSUFFICIENT_STOCK,
      message: `No alcanza la existencia. Hay ${spoken(error.available)}.`,
      details: { itemId: error.itemId, available: error.available },
    });
  }

  if (error instanceof ItemInactiveError) {
    return new ConflictException({
      code: API_ERROR_CODES.ITEM_INACTIVE,
      message: 'Ese artículo está desactivado.',
      details: { itemId: error.itemId },
    });
  }

  if (error instanceof ItemNotSellableError) {
    return new ConflictException({
      code: API_ERROR_CODES.ITEM_NOT_SELLABLE,
      message: 'Ese artículo es un insumo: no se vende.',
      details: { itemId: error.itemId },
    });
  }

  if (error instanceof InventoryItemNotFoundError) {
    return new NotFoundException({
      code: API_ERROR_CODES.NOT_FOUND,
      message: 'Ese artículo no existe.',
      details: { itemId: error.itemId },
    });
  }

  if (error instanceof BarcodeTakenError) {
    return new ConflictException({
      code: API_ERROR_CODES.BARCODE_TAKEN,
      message: 'Otro artículo ya tiene ese código de barras.',
      details: { barcode: error.barcode },
    });
  }

  if (error instanceof CategoryNameTakenError) {
    return new ConflictException({
      code: API_ERROR_CODES.CATEGORY_NAME_TAKEN,
      message: 'Ya existe una categoría con ese nombre.',
      details: { name: error.categoryName },
    });
  }

  if (error instanceof SupplyHasPriceError) {
    return new BadRequestException({
      code: API_ERROR_CODES.SUPPLY_HAS_PRICE,
      message: 'Un insumo no lleva precio de venta.',
    });
  }

  if (error instanceof ProductPriceRequiredError) {
    return new UnprocessableEntityException({
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
    throw toInventoryHttpError(error);
  }
}
