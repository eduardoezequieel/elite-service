import { API_ERROR_CODES } from '@elite/shared';

import { availableLabel } from './format';

/**
 * Los errores del API del inventario, en la frase que ve la persona (spec 065).
 *
 * `apiFetch` ya normaliza todo a `{ code, message, details? }`: esto no es otro
 * manejador, es la traducción de los códigos nuevos a lo que la pantalla dice
 * y a qué campo le toca. El mensaje del API queda como respaldo.
 */

export interface InventoryErrorLike {
  code: string;
  message: string;
  details?: unknown;
}

/** El campo del formulario al que se le pega el error, si lo hay. */
export type InventoryErrorField =
  | 'name'
  | 'barcode'
  | 'price'
  | 'unit'
  | 'minStock'
  | 'categoryId'
  | 'quantity'
  | 'employeeId'
  | 'unitCost'
  | 'reference'
  | 'reason'
  | 'note';

export interface InventoryErrorView {
  /** El mensaje general, al pie del formulario. */
  message: string;
  /** Si el error es de un campo, cuál. */
  field?: InventoryErrorField;
}

function detailsRecord(details: unknown): Record<string, unknown> | null {
  return typeof details === 'object' && details !== null
    ? (details as Record<string, unknown>)
    : null;
}

/** `details.available` del `INSUFFICIENT_STOCK`, como cadena, o `null`. */
export function availableFrom(details: unknown): string | null {
  const available = detailsRecord(details)?.available;

  if (typeof available === 'string') return available;
  if (typeof available === 'number' && Number.isFinite(available)) return available.toFixed(3);

  return null;
}

/**
 * Traduce un error del API del inventario. `unit` es la unidad del artículo en
 * juego, para decir «Hay 4 litro» y no solo «Hay 4».
 */
export function inventoryErrorView(error: InventoryErrorLike, unit?: string): InventoryErrorView {
  switch (error.code) {
    case API_ERROR_CODES.INSUFFICIENT_STOCK: {
      const available = availableFrom(error.details);

      return {
        field: 'quantity',
        message:
          available === null
            ? 'No alcanza la existencia para eso.'
            : `No alcanza. ${availableLabel(available, unit)}.`,
      };
    }
    case API_ERROR_CODES.ITEM_INACTIVE:
      return { message: 'El artículo está inactivo. Activalo desde «Editar» para moverlo.' };
    case API_ERROR_CODES.ITEM_NOT_SELLABLE:
      return { message: 'Es un insumo: no se vende, se despacha.' };
    case API_ERROR_CODES.BARCODE_TAKEN:
      return { field: 'barcode', message: 'Otro artículo ya tiene ese código de barras.' };
    case API_ERROR_CODES.SUPPLY_HAS_PRICE:
      return { field: 'price', message: 'Un insumo no lleva precio: no se vende.' };
    case API_ERROR_CODES.CATEGORY_NAME_TAKEN:
      return { field: 'name', message: 'Ya hay una categoría con ese nombre.' };
    case API_ERROR_CODES.EMPLOYEE_NOT_FOUND:
      return {
        field: 'employeeId',
        message: 'Ese empleado ya no está activo. Elegí otro.',
      };
    default:
      return { message: error.message };
  }
}

/**
 * Los mensajes por campo de un `VALIDATION_ERROR`, solo de los campos que el
 * formulario conoce. Lo demás queda en el mensaje general.
 */
export function validationFieldErrors<Field extends string>(
  error: InventoryErrorLike,
  fields: readonly Field[],
): Partial<Record<Field, string>> {
  if (error.code !== API_ERROR_CODES.VALIDATION_ERROR) return {};

  const details = detailsRecord(error.details);
  if (details === null) return {};

  const result: Partial<Record<Field, string>> = {};
  for (const field of fields) {
    const message = details[field];
    if (typeof message === 'string') result[field] = message;
    else if (Array.isArray(message) && typeof message[0] === 'string') result[field] = message[0];
  }

  return result;
}
