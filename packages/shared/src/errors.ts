/**
 * Catalogo de codigos de error del API. Crece cuando una spec aprobada lo
 * requiera; los codigos son estables y en ingles (son parte del contrato).
 */
export const API_ERROR_CODES = {
  /** Request malformado (JSON roto, cuerpo ilegible): el filtro del API lo
   * emite para un 400. Los datos malos son `VALIDATION_ERROR` (422). */
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  /** La peticion nunca llego al API (red, DNS, CORS). No lo emite el API: lo
   * produce solo `apiFetch` del web, con status 0. */
  NETWORK_ERROR: 'NETWORK_ERROR',

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
  /** Ya existe un empleado con ese PIN, activo o no (044 RN-3). */
  PIN_TAKEN: 'PIN_TAKEN',
  /** Demasiados intentos fallidos de entrar a la pista desde la misma IP
   * (044 RN-6). */
  TOO_MANY_ATTEMPTS: 'TOO_MANY_ATTEMPTS',
  /** Ya existe un vehiculo activo con esa placa (RN-12). */
  PLATE_TAKEN: 'PLATE_TAKEN',
  /** Al ticket le falta placa, tipo de carro o al menos un servicio
   * activo (RN-7, 040). */
  TICKET_INCOMPLETE: 'TICKET_INCOMPLETE',
  /** La operacion solo vale sobre un ticket `OPEN` (RN-9). */
  TICKET_NOT_OPEN: 'TICKET_NOT_OPEN',
  /** La operacion solo vale sobre un ticket `READY` (RN-9). */
  TICKET_NOT_READY: 'TICKET_NOT_READY',
  /** Solo se anula un ticket `OPEN` o `READY`; `PAID` y `VOID` no salen de ahi
   * (RN-11). */
  TICKET_NOT_VOIDABLE: 'TICKET_NOT_VOIDABLE',
  /** El cobro no se puede deshacer: no está PAID o no es del turno abierto. */
  TICKET_NOT_REVERSIBLE: 'TICKET_NOT_REVERSIBLE',
  /** Oficina no mueve un ticket `PAID` o `VOID` por el endpoint de estado (037). */
  TICKET_STATUS_LOCKED: 'TICKET_STATUS_LOCKED',
  /** El destino del cambio de estado es el estado actual (037). */
  TICKET_ALREADY_IN_STATUS: 'TICKET_ALREADY_IN_STATUS',
  /** Se intento poner un precio por encima del de catalogo. El descuento solo
   * baja (RN-5). */
  PRICE_ABOVE_CATALOG: 'PRICE_ABOVE_CATALOG',
  /** El monto del pago no es igual al total del ticket (RN-10). */
  PAYMENT_AMOUNT_MISMATCH: 'PAYMENT_AMOUNT_MISMATCH',
  /** El empleado indicado no existe o esta inactivo (RN-8). */
  INVALID_WASHER: 'INVALID_WASHER',
  /** Operacion de empleados asignados sobre un ticket `PAID` o `VOID` (spec 009). */
  WASHERS_LOCKED: 'WASHERS_LOCKED',

  // --- spec 039: un servicio por categoria ---
  /** Llegaron dos servicios del mismo rubro en el mismo ticket (RN-1). */
  DUPLICATE_SERVICE_CATEGORY: 'DUPLICATE_SERVICE_CATEGORY',

  // --- spec 010: carwash cash ---
  /** Se intento cobrar o cerrar sin una sesion OPEN (RN-2, RN-6). */
  CASH_NOT_OPEN: 'CASH_NOT_OPEN',
  /** Ya hay una sesion OPEN; no se abre otra (RN-1). */
  CASH_ALREADY_OPEN: 'CASH_ALREADY_OPEN',

  // --- spec 012: vehicle lookup on intake ---
  /** Ya existe un vehiculo con esa placa y no se confirmo el vehicleId. */
  VEHICLE_PLATE_EXISTS: 'VEHICLE_PLATE_EXISTS',

  // --- spec 040: responsable opcional ---
  /** El carro ya tiene responsable y no se pidio confirmar el cambio (012). */
  VEHICLE_HAS_OWNER: 'VEHICLE_HAS_OWNER',

  // --- spec 045: autorizacion para anular ---
  /** Las credenciales de autorizacion no sirven: contrasena incorrecta, usuario
   * desactivado o sin el permiso que la accion exige. El mensaje es el mismo en
   * los tres casos (RN-2). Es 403 y no 401 a proposito: un 401 lo lee el front
   * como sesion vencida y mandaria a login al que esta adelante. */
  AUTHORIZATION_FAILED: 'AUTHORIZATION_FAILED',

  // --- spec 059: cuenta de cobro, pago partido y vuelto ---
  /** Alguno de los lavados de la cuenta ya tiene cobro (RN-4). */
  TICKET_ALREADY_CHARGED: 'TICKET_ALREADY_CHARGED',
  /** El efectivo que entrega el cliente no alcanza para la parte en efectivo
   * del cobro (RN-10). */
  CASH_TENDERED_SHORT: 'CASH_TENDERED_SHORT',

  // --- spec 060: cambiar un precio pide autorizacion ---
  /** Llego un precio distinto al de catalogo por un camino que no autoriza:
   * desde READY el precio solo se cambia por el endpoint de la 060 (RN-1). */
  PRICE_CHANGE_NOT_AUTHORIZED: 'PRICE_CHANGE_NOT_AUTHORIZED',

  // --- spec 065: inventario y venta suelta ---
  /** El movimiento dejaria la existencia bajo cero (RN-3). `details: { itemId,
   * available }`, con `available` como cadena de tres decimales. */
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  /** El articulo es un insumo (`SUPPLY`): no se vende (RN-1, RN-21). */
  ITEM_NOT_SELLABLE: 'ITEM_NOT_SELLABLE',
  /** El articulo esta desactivado: no se vende, no se despacha ni recibe
   * entradas (RN-14). */
  ITEM_INACTIVE: 'ITEM_INACTIVE',
  /** Se mando precio mayor que cero para un insumo (RN-1). */
  SUPPLY_HAS_PRICE: 'SUPPLY_HAS_PRICE',
  /** Otro articulo ya tiene ese codigo de barras (RN-15). */
  BARCODE_TAKEN: 'BARCODE_TAKEN',
  /** Ya existe una categoria de inventario con ese nombre. */
  CATEGORY_NAME_TAKEN: 'CATEGORY_NAME_TAKEN',
  /** La venta suelta ya estaba anulada (RN-22). */
  SALE_ALREADY_VOID: 'SALE_ALREADY_VOID',
  /** La venta no es del turno de caja abierto: ya no se puede anular (RN-22). */
  CASH_SESSION_GONE: 'CASH_SESSION_GONE',
  /** El empleado que recibe el despacho no existe o esta inactivo (RN-10). */
  EMPLOYEE_NOT_FOUND: 'EMPLOYEE_NOT_FOUND',

  // --- spec 072: insumos y productos sin confusion ---
  /** El articulo es un producto: no se despacha, se anota como consumo (070). */
  ITEM_NOT_DISPATCHABLE: 'ITEM_NOT_DISPATCHABLE',
  /** La categoria es de otro tipo que el articulo (producto vs. insumo). */
  CATEGORY_KIND_MISMATCH: 'CATEGORY_KIND_MISMATCH',

  // --- spec 070: consumo de empleados ---
  /** Ese consumo ya se anulo: se anula una sola vez y entero (RN-6). 409. */
  CONSUMPTION_ALREADY_REVERSED: 'CONSUMPTION_ALREADY_REVERSED',

  // --- spec 069: cuentas bancarias y metodo «Otro» ---
  /** Ya existe una cuenta con ese banco y numero (RN-2). 409. */
  BANK_ACCOUNT_DUPLICATE: 'BANK_ACCOUNT_DUPLICATE',
  /** La cuenta de una transferencia no existe o esta inactiva (RN-3, RN-4).
   * 422; no se cobra nada. */
  BANK_ACCOUNT_UNAVAILABLE: 'BANK_ACCOUNT_UNAVAILABLE',

  // --- spec 071: un solo lavado en curso por empleado ---
  /** El empleado ya tiene otro lavado en `WASHING`. 409. `details: { ticketId,
   * number, plate, employeeId }` del que ya esta lavando. */
  EMPLOYEE_ALREADY_WASHING: 'EMPLOYEE_ALREADY_WASHING',

  // --- spec 074: el rol del sistema ---
  /** Se intento borrar el rol del sistema (`isSystem`) o dejarlo sin
   * `roles.manage`. 409. Renombrarlo si se puede. */
  SYSTEM_ROLE_PROTECTED: 'SYSTEM_ROLE_PROTECTED',

  // --- spec 090: frenos del ciclo del lavado ---
  /** El carro ya tiene un lavado sin cobrar (`OPEN`, `WASHING` o `READY`). 409.
   * `details: { ticketId, number, plate, status }` de ese lavado, cuando se sabe
   * cual es. */
  VEHICLE_HAS_ACTIVE_TICKET: 'VEHICLE_HAS_ACTIVE_TICKET',
  /** Se quiso desactivar a un empleado con lavados a su cargo en `OPEN` o
   * `WASHING`. 409. `details: { tickets: [{ ticketId, number, plate, status }] }`. */
  EMPLOYEE_HAS_ACTIVE_TICKETS: 'EMPLOYEE_HAS_ACTIVE_TICKETS',
} as const;

/** Union de los codigos de error validos. */
export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

const API_ERROR_CODE_VALUES: ReadonlySet<string> = new Set(Object.values(API_ERROR_CODES));

/** `true` si el texto es un codigo del catalogo. */
export function isApiErrorCode(value: string): value is ApiErrorCode {
  return API_ERROR_CODE_VALUES.has(value);
}

/**
 * Formato unico de error del API. El backend lo produce desde un solo filtro de
 * excepciones y el frontend lo consume desde un solo interceptor.
 */
export interface ApiErrorResponse {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
}
