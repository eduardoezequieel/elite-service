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

  // --- spec 001: auth y RBAC dinamico ---
  /** Credenciales invalidas o usuario desactivado. El mensaje es el mismo en
   * ambos casos: no se revela cual de los dos fallo. */
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  /** Ya existe un usuario con ese correo. */
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  /** Ya existe un rol con ese nombre. */
  NAME_TAKEN: 'NAME_TAKEN',
  /** El rol tiene usuarios asignados y no puede eliminarse (RN-6). */
  ROLE_IN_USE: 'ROLE_IN_USE',
  /** La operacion dejaria al propio solicitante sin acceso o sin
   * `roles.manage` (RN-5). Aplica a las dos puertas: editar el usuario y
   * editar el rol. */
  SELF_LOCKOUT: 'SELF_LOCKOUT',
  /** Se referencio un rol que no existe. */
  INVALID_ROLE: 'INVALID_ROLE',
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
