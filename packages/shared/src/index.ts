/**
 * @elite/shared — contrato compartido entre el frontend (@elite/web) y el
 * backend (@elite/api). Sin dependencias de Next ni de Nest.
 */

/**
 * Catalogo de codigos de error del API. Crece cuando una spec aprobada lo
 * requiera; los codigos son estables y en ingles (son parte del contrato).
 */
export const API_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/** Union de los codigos de error validos. */
export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

/**
 * Formato unico de error del API. El backend lo produce desde un solo filtro de
 * excepciones y el frontend lo consume desde un solo interceptor.
 */
export interface ApiErrorResponse {
  code: string;
  message: string;
  details?: unknown;
}
