/**
 * Contrato único de errores del API: `{ code, message, details? }`.
 *
 * Fase 0: el shape se define localmente para que el API compile sin depender
 * del build (`dist`) de `@elite/shared`. Cuando `@elite/shared` esté publicando
 * `ApiErrorResponse` y `API_ERROR_CODES`, reemplazar este archivo por un
 * re-export del paquete compartido y borrar las definiciones locales.
 */

export const API_ERROR_CODES = {
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

export interface ApiErrorResponse {
  /** Clave estable, en inglés y MAYÚSCULAS, que el frontend puede mapear. */
  code: string;
  /** Mensaje legible. La UI puede mostrarlo tal cual o traducirlo por `code`. */
  message: string;
  /** Información adicional opcional (errores de validación por campo, etc.). */
  details?: unknown;
}

/** Mapea un status HTTP al `code` por defecto del contrato de errores. */
export function errorCodeForStatus(status: number): string {
  switch (status) {
    case 400:
      return API_ERROR_CODES.BAD_REQUEST;
    case 401:
      return API_ERROR_CODES.UNAUTHORIZED;
    case 403:
      return API_ERROR_CODES.FORBIDDEN;
    case 404:
      return API_ERROR_CODES.NOT_FOUND;
    case 409:
      return API_ERROR_CODES.CONFLICT;
    case 422:
      return API_ERROR_CODES.VALIDATION_ERROR;
    case 429:
      return API_ERROR_CODES.TOO_MANY_REQUESTS;
    default:
      return status >= 500 ? API_ERROR_CODES.INTERNAL_ERROR : API_ERROR_CODES.BAD_REQUEST;
  }
}
