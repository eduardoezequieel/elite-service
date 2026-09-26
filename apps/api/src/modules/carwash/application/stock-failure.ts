import { API_ERROR_CODES } from '@elite/shared';
import { ConflictException, UnprocessableEntityException } from '@nestjs/common';

import {
  InsufficientStockError,
  InventoryItemNotFoundError,
  ItemInactiveError,
  ItemNotSellableError,
} from '../../inventory/domain/stock';
import { TicketNotEditableError } from './ports/ticket.repository';

/**
 * Traduce a HTTP lo que el kardex rechazo al guardar un lavado (065).
 *
 * Lo que no es del inventario se devuelve tal cual: quien llama lo relanza.
 * `InventoryItemNotFoundError` sale igual que un servicio que no existe —422
 * `VALIDATION_ERROR`—: es un id que mando el cliente y no apunta a nada.
 */
export function stockFailure(error: unknown): unknown {
  if (error instanceof InsufficientStockError) {
    return new ConflictException({
      code: API_ERROR_CODES.INSUFFICIENT_STOCK,
      message: `No alcanza la existencia: hay ${trimQuantity(error.available)}.`,
      details: { itemId: error.itemId, available: error.available },
    });
  }

  if (error instanceof ItemNotSellableError) {
    return new ConflictException({
      code: API_ERROR_CODES.ITEM_NOT_SELLABLE,
      message: 'Ese artículo es un insumo: no se vende.',
      details: { itemId: error.itemId },
    });
  }

  if (error instanceof ItemInactiveError) {
    return new ConflictException({
      code: API_ERROR_CODES.ITEM_INACTIVE,
      message: 'Ese producto está desactivado: no se vende.',
      details: { itemId: error.itemId },
    });
  }

  if (error instanceof InventoryItemNotFoundError) {
    return new UnprocessableEntityException({
      code: API_ERROR_CODES.VALIDATION_ERROR,
      message: 'Ese producto no existe.',
      details: { inventoryItemId: error.itemId },
    });
  }

  if (error instanceof TicketNotEditableError) {
    return new ConflictException({
      code: API_ERROR_CODES.TICKET_NOT_OPEN,
      message: 'Ese lavado ya no se puede editar.',
    });
  }

  return error;
}

/** `"1.000"` → `"1"`, `"0.500"` → `"0.5"`: para el mensaje, no para `details`. */
function trimQuantity(value: string): string {
  return value.replace(/\.?0+$/, '');
}
