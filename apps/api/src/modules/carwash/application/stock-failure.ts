import { API_ERROR_CODES } from '@elite/shared';

import { ConflictError, ValidationError } from '../../../common/errors/application-error';
import {
  InsufficientStockError,
  InventoryItemNotFoundError,
  ItemInactiveError,
  ItemNotSellableError,
} from '../../inventory/domain/stock';
import { TicketNotEditableError, VehiclePlateTakenError } from './ports/ticket.repository';

/**
 * Traduce a un `ApplicationError` lo que el kardex rechazo al guardar un lavado
 * (065, 084). El status lo pone `AllExceptionsFilter`.
 *
 * Lo que no es del inventario se devuelve tal cual: quien llama lo relanza.
 * `InventoryItemNotFoundError` sale igual que un servicio que no existe —422
 * `VALIDATION_ERROR`—: es un id que mando el cliente y no apunta a nada.
 * La placa que otra alta tomo en la misma carrera (079) sale igual que la
 * regla de placa tomada, sin ficha: la pantalla vuelve a buscarla.
 */
export function stockFailure(error: unknown): unknown {
  if (error instanceof InsufficientStockError) {
    return new ConflictError({
      code: API_ERROR_CODES.INSUFFICIENT_STOCK,
      message: `No alcanza la existencia: hay ${trimQuantity(error.available)}.`,
      details: { itemId: error.itemId, available: error.available },
    });
  }

  if (error instanceof ItemNotSellableError) {
    return new ConflictError({
      code: API_ERROR_CODES.ITEM_NOT_SELLABLE,
      message: 'Ese artículo es un insumo: no se vende.',
      details: { itemId: error.itemId },
    });
  }

  if (error instanceof ItemInactiveError) {
    return new ConflictError({
      code: API_ERROR_CODES.ITEM_INACTIVE,
      message: 'Ese producto está desactivado: no se vende.',
      details: { itemId: error.itemId },
    });
  }

  if (error instanceof InventoryItemNotFoundError) {
    return new ValidationError({
      code: API_ERROR_CODES.VALIDATION_ERROR,
      message: 'Ese producto no existe.',
      details: { inventoryItemId: error.itemId },
    });
  }

  if (error instanceof TicketNotEditableError) {
    return new ConflictError({
      code: API_ERROR_CODES.TICKET_NOT_OPEN,
      message: 'Ese lavado ya no se puede editar.',
    });
  }

  if (error instanceof VehiclePlateTakenError) {
    return new ConflictError({
      code: API_ERROR_CODES.VEHICLE_PLATE_EXISTS,
      message: 'Ya existe un vehículo con esa placa.',
    });
  }

  return error;
}

/** `"1.000"` → `"1"`, `"0.500"` → `"0.5"`: para el mensaje, no para `details`. */
function trimQuantity(value: string): string {
  return value.replace(/\.?0+$/, '');
}
