import type { ApiErrorResponse } from '@elite/shared';
import { HttpException } from '@nestjs/common';

/**
 * Ayuda de tests: corre algo que debe fallar y devuelve el status y el payload
 * `{ code, message, details? }` con el que el filtro global armará la respuesta.
 */
export async function captureApiError(
  action: Promise<unknown>,
): Promise<{ status: number; body: ApiErrorResponse }> {
  try {
    await action;
  } catch (error) {
    if (error instanceof HttpException) {
      return { status: error.getStatus(), body: error.getResponse() as ApiErrorResponse };
    }

    throw error;
  }

  throw new Error('Se esperaba un error del caso de uso, pero resolvió bien.');
}
