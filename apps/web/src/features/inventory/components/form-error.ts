import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import type { ApiError } from '@/lib/api';
import { inventoryErrorView, validationFieldErrors } from '../errors';

/**
 * Baja un error del API al campo donde ocurrió y devuelve el mensaje general,
 * que el diálogo imprime al pie con `role=alert` (convención 16: los errores se
 * dicen donde ocurren, nunca en un toast).
 */
export function applyInventoryError<T extends FieldValues>(
  error: ApiError,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
  unit?: string,
): string {
  const view = inventoryErrorView(error, unit);
  const field = fields.find((candidate) => candidate === view.field);
  if (field !== undefined) setError(field, { message: view.message });

  const perField = validationFieldErrors(error, fields);
  for (const name of fields) {
    const message = perField[name];
    if (message !== undefined) setError(name, { message });
  }

  return view.message;
}
