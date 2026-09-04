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

  // --- spec 003: carwash ---
  /** Ya existe un empleado con ese usuario de pista. */
  USERNAME_TAKEN: 'USERNAME_TAKEN',
  /** Ya existe un vehiculo activo con esa placa (RN-12). */
  PLATE_TAKEN: 'PLATE_TAKEN',
  /** Al ticket le falta cliente, placa, tipo de carro o al menos un servicio
   * activo (RN-7). */
  TICKET_INCOMPLETE: 'TICKET_INCOMPLETE',
  /** La operacion solo vale sobre un ticket `OPEN` (RN-9). */
  TICKET_NOT_OPEN: 'TICKET_NOT_OPEN',
  /** La operacion solo vale sobre un ticket `READY` (RN-9). */
  TICKET_NOT_READY: 'TICKET_NOT_READY',
  /** Solo se anula un ticket `OPEN` o `READY`; `PAID` y `VOID` no salen de ahi
   * (RN-11). */
  TICKET_NOT_VOIDABLE: 'TICKET_NOT_VOIDABLE',
  /** Se intento poner un precio por encima del de catalogo. El descuento solo
   * baja (RN-5). */
  PRICE_ABOVE_CATALOG: 'PRICE_ABOVE_CATALOG',
  /** El monto del pago no es igual al total del ticket (RN-10). */
  PAYMENT_AMOUNT_MISMATCH: 'PAYMENT_AMOUNT_MISMATCH',
  /** El lavador indicado no existe o esta inactivo (RN-8). */
  INVALID_WASHER: 'INVALID_WASHER',
  /** Operacion de lavadores sobre un ticket `PAID` o `VOID` (spec 009). */
  WASHERS_LOCKED: 'WASHERS_LOCKED',

  // --- spec 010: carwash cash ---
  /** Se intento cobrar o cerrar sin una sesion OPEN (RN-2, RN-6). */
  CASH_NOT_OPEN: 'CASH_NOT_OPEN',
  /** Ya hay una sesion OPEN; no se abre otra (RN-1). */
  CASH_ALREADY_OPEN: 'CASH_ALREADY_OPEN',

  // --- spec 012: vehicle lookup on intake ---
  /** Ya existe un vehiculo con esa placa y no se confirmo el vehicleId. */
  VEHICLE_PLATE_EXISTS: 'VEHICLE_PLATE_EXISTS',
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
