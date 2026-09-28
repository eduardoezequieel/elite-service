import type { ApiErrorResponse } from '@elite/shared';

import { ApplicationError } from '../../../../common/errors/application-error';
import { applicationErrorStatus } from '../../../../common/filters/application-error-status';

/**
 * Ayuda de tests: corre algo que debe fallar y devuelve el status y el payload
 * `{ code, message, details? }` con el que el filtro global armará la respuesta.
 * El status sale del mismo mapa que usa `AllExceptionsFilter` (spec 084).
 */
export async function captureApiError(
  action: Promise<unknown>,
): Promise<{ status: number; body: ApiErrorResponse }> {
  try {
    await action;
  } catch (error) {
    if (error instanceof ApplicationError) {
      return { status: applicationErrorStatus(error), body: error.payload };
    }

    throw error;
  }

  throw new Error('Se esperaba un error del caso de uso, pero resolvió bien.');
}
