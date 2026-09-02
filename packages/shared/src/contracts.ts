/**
 * Formas que viajan por el API de auth, usuarios y roles (spec 001).
 *
 * Son el contrato: el backend las produce y el frontend las consume sin
 * redefinirlas. Las fechas viajan como ISO 8601, porque JSON no tiene fechas.
 */

/** Un rol visto desde un usuario: lo minimo para mostrarlo en una tabla. */
export interface RoleSummary {
  id: string;
  name: string;
}

/**
 * Un usuario tal como sale del API. Nunca incluye `passwordHash`: no se
 * devuelve ni se loguea (RN-7).
 */
export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  roles: RoleSummary[];
  createdAt: string;
  updatedAt: string;
}

/** Un rol con sus permisos y cuantos usuarios lo tienen asignado. */
export interface RoleDetail {
  id: string;
  name: string;
  description: string | null;
  permissionKeys: string[];
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Respuesta de `POST /auth/login`. La sesion viaja en cookie httpOnly. */
export interface LoginResponse {
  user: PublicUser;
  /** Union de los permisos de todos sus roles (RN-3). */
  permissions: string[];
}

/**
 * Respuesta de `GET /auth/me`. Los permisos se resuelven contra la base en cada
 * request, no quedan congelados en el JWT (RN-6b).
 */
export interface SessionResponse {
  user: PublicUser;
  roles: RoleSummary[];
  permissions: string[];
}

// ============================================================================
// spec 003 — Carwash
//
// El dinero viaja como cadena decimal (`"14.00"`), no como `number`: el backend
// lo guarda en `Decimal(12, 2)` y lo suma en centavos enteros, y pasarlo por un
// `number` de JavaScript en el camino reintroduce el error de punto flotante
// que RN-10 no tolera (el cobro exige monto IGUAL al total).
// ============================================================================

/** Quien trabaja en la pista. Nunca incluye `pinHash` (RN-18). */
export interface PublicEmployee {
  id: string;
  username: string;
  fullName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Respuesta de `POST /floor/login` y `GET /floor/me`. */
export interface FloorSessionResponse {
  employee: Pick<PublicEmployee, 'id' | 'username' | 'fullName'>;
}

export interface VehicleBodyType {
  id: string;
  key: string;
  name: string;
  sortOrder: number;
}

export interface Customer {
  id: string;
  fullName: string;
  phone: string | null;
  isActive: boolean;
}

/**
 * Un cliente que ya existe y se parece al que se está por anotar (004 RN-1).
 *
 * `on` dice **por qué** coincide, y es lo que deja escribir el diálogo «¿es el
 * mismo?» en un idioma —«mismo teléfono» / «mismo nombre»— sin que la web
 * tenga que repetir la regla de comparación que ya aplicó el backend.
 */
export interface CustomerMatch {
  customer: Customer;
  /** El teléfono pesa más que el nombre: si coinciden los dos, gana `phone`. */
  on: 'phone' | 'name';
}

/** Un vehículo con su dueño actual (RN-12). */
export interface VehicleWithOwner {
  id: string;
  plate: string;
  bodyType: VehicleBodyType;
  make: string | null;
  color: string | null;
  isActive: boolean;
  currentOwner: Customer | null;
}

export interface ServiceCategorySummary {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

/** Un servicio con su matriz de precios. Matriz vacía = usa siempre el base (RN-3). */
export interface ServiceDetail {
  id: string;
  code: string;
  name: string;
  category: ServiceCategorySummary;
  /** Precio base con IVA incluido, como cadena decimal. */
  defaultPrice: string;
  taxRate: string;
  isActive: boolean;
  /** Una entrada por tipo de carro que tenga precio propio. */
  prices: { bodyTypeId: string; price: string }[];
}

export type WorkOrderStatus = 'OPEN' | 'READY' | 'PAID' | 'VOID';
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER';

/** Una línea del ticket. Es un snapshot del catálogo al agregarla (RN-4). */
export interface TicketItem {
  id: string;
  serviceId: string | null;
  serviceCode: string;
  serviceName: string;
  /** Techo del descuento: lo que decía el catálogo al agregar la línea (RN-5). */
  catalogPrice: string;
  /** Lo que se cobra. Entre 0 y `catalogPrice`. */
  unitPrice: string;
  sortOrder: number;
}

/** Quién lavó. `null` cuando el ticket se abrió desde oficina sin elegir a nadie (RN-8). */
export type TicketWasher = Pick<PublicEmployee, 'id' | 'username' | 'fullName'> | null;

export interface TicketPayment {
  method: PaymentMethod;
  amount: string;
  paidAt: string;
}

/** Un lavado, como lo ven las dos vistas. La de pista ignora `payment`. */
export interface Ticket {
  id: string;
  /** `CW-0014`. En pantalla se muestra como `#14` (RN-15). */
  number: string;
  status: WorkOrderStatus;
  customer: Customer;
  vehicle: VehicleWithOwner;
  bodyType: VehicleBodyType;
  items: TicketItem[];
  /** Suma de `unitPrice`, con IVA incluido (RN-6, RN-14). */
  total: string;
  washer: TicketWasher;
  notes: string | null;
  payment: TicketPayment | null;
  createdAt: string;
  updatedAt: string;
}
