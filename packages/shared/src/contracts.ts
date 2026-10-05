import type { PaymentBankAccount } from './banking/contracts';
import type { PermissionKey } from './permissions';

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
  permissionKeys: PermissionKey[];
  userCount: number;
  /** El rol que mantiene el seed (spec 074): no se borra ni pierde
   * `roles.manage`. Se puede renombrar. */
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Respuesta de `POST /auth/login`. La sesion viaja en cookie httpOnly. */
export interface LoginResponse {
  user: PublicUser;
  /** Union de los permisos de todos sus roles (RN-3). */
  permissions: PermissionKey[];
}

/**
 * Respuesta de `GET /auth/me`. Los permisos se resuelven contra la base en cada
 * request, no quedan congelados en el JWT (RN-6b).
 */
export interface SessionResponse {
  user: PublicUser;
  roles: RoleSummary[];
  permissions: PermissionKey[];
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

/**
 * Un cliente. No tiene estado: no es un actor del sistema —no entra, no cobra,
 * no tiene permisos—, así que no se desactiva ni se reactiva, se corrige (048).
 */
export interface Customer {
  id: string;
  fullName: string;
  phone: string | null;
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

/** Una línea del lavado anterior, tal como se cobró (060, 065). */
export interface LastWashItem {
  /** Servicio o producto (065). */
  kind: TicketItemKind;
  /** Snapshot del nombre, sea servicio o producto. */
  serviceName: string;
  /** Lo que se cobró por unidad, ya con descuento. Cadena decimal. */
  unitPrice: string;
  /** Tres decimales (`"2.000"`). Siempre `"1.000"` en un servicio (065 RN-6). */
  quantity: string;
  /** `unitPrice × quantity`, dos decimales (065 RN-6). */
  total: string;
}

/**
 * El último lavado no anulado de un carro (041, 057): la factura resumida, para
 * que la ficha «Ya lo conocemos» diga qué se le hizo, cuánto salió y cómo se
 * pagó. `notes` viene vacío (`null`) si en ese ticket no se anotó nada: la ficha
 * no inventa texto. `payments` viene vacío si ese lavado todavía no se cobró, y
 * trae más de uno cuando el cobro se partió en métodos (059).
 */
export interface LastWash {
  id: string;
  /** `CW-0048`. En pantalla, `#48`. */
  number: string;
  createdAt: string;
  /** Nombres de quienes lavaron. Vacío si lo hizo oficina. */
  washers: string[];
  items: LastWashItem[];
  /** Suma de los `total` de cada línea. Cadena decimal. */
  total: string;
  payments: { method: PaymentMethod; paidAt: string }[];
  notes: string | null;
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
  /** Ausente si el carro no tiene un lavado no anulado. */
  lastWash: LastWash | null;
}

export interface ServiceCategorySummary {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  /**
   * Sus servicios cuentan como «extra» en Rendimiento (spec 067): lo que se
   * vende además del lavado. La categoría del lavado principal va en `false`.
   */
  isExtra: boolean;
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

export type WorkOrderStatus = 'OPEN' | 'WASHING' | 'READY' | 'PAID' | 'VOID';
/** Métodos de pago. `OTHER` (069) = cheque, billetera, lo que no es los otros tres. */
export const PAYMENT_METHODS = ['CASH', 'CARD', 'TRANSFER', 'OTHER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * Lo que un pago guardado trae según su método (069). `bankAccount` y
 * `reference` solo en `TRANSFER`; `bankAccount` sale `null` en transferencias
 * anteriores a la 069 («Sin cuenta»). `description` solo en `OTHER`.
 */
export interface PaymentMethodDetails {
  bankAccount: PaymentBankAccount | null;
  reference: string | null;
  description: string | null;
}

/** Qué es una línea del lavado: un servicio del catálogo o un producto del inventario (065). */
export type TicketItemKind = 'SERVICE' | 'PRODUCT';

/**
 * Una línea del ticket. Es un snapshot del catálogo al agregarla (RN-4).
 *
 * Desde la 065 una línea es un servicio o un producto (`kind`). `code` / `name`
 * son el snapshot de código y nombre de cualquiera de los dos; `serviceCode` /
 * `serviceName` se conservan con el mismo valor para no romper a quien ya los
 * lee (en la base siguen siendo esas columnas, no se renombraron).
 */
export interface TicketItem {
  id: string;
  kind: TicketItemKind;
  /** Solo en líneas `SERVICE`. */
  serviceId: string | null;
  /** Solo en líneas `PRODUCT` (065). */
  inventoryItemId: string | null;
  /** Snapshot del código: `LAV-01`, `INV-0003`. */
  code: string;
  /** Snapshot del nombre. */
  name: string;
  /** Igual a `code`. Se mantiene por compatibilidad (065). */
  serviceCode: string;
  /** Igual a `name`. Se mantiene por compatibilidad (065). */
  serviceName: string;
  /** Techo del descuento: lo que decía el catálogo al agregar la línea (RN-5). */
  catalogPrice: string;
  /** Lo que se cobra por unidad. Entre 0 y `catalogPrice`. */
  unitPrice: string;
  /** Cadena de tres decimales (`"2.000"`). Siempre `"1.000"` en un servicio (065 RN-6). */
  quantity: string;
  /** `unitPrice × quantity`, cadena decimal de dos decimales (065 RN-6). */
  total: string;
  sortOrder: number;
  /**
   * Quién firmó el precio cuando se apartó del catálogo con el lavado ya listo
   * (060). `null` = precio del catálogo o rebaja hecha con el lavado abierto,
   * que no pide firma.
   */
  priceAuthorizedBy: { id: string; fullName: string } | null;
  priceAuthorizedAt: string | null;
  priceReason: string | null;
  /** El precio que tenía la línea antes de esa firma. */
  previousUnitPrice: string | null;
  /** Combo del que salió la línea (104). `null` en una línea suelta. */
  comboId: string | null;
  /** Snapshot del nombre del combo al agregarlo: editarlo después no lo cambia (104 RN-4). */
  comboName: string | null;
}

/**
 * Quién lavó. El singular `Ticket.washer` sigue pudiendo ser `null` (oficina);
 * los elementos de `Ticket.washers` no. Escrituras nuevas: 0 o 1 (035).
 */
export type TicketWasher = Pick<PublicEmployee, 'id' | 'username' | 'fullName'>;

/** Empleado activo. Sin username ni PIN. */
export type FloorEmployeeOption = Pick<PublicEmployee, 'id' | 'fullName'>;

export interface TicketPayment extends PaymentMethodDetails {
  method: PaymentMethod;
  amount: string;
  paidAt: string;
  /**
   * Quién cobró (053). Sale de `payments.recordedByUserId`, que existe y es
   * obligatorio desde la 003, así que nunca falta. Es el nombre **actual**: a
   * diferencia del historial de la 046, acá no se copia el del día del cobro.
   */
  recordedBy: { id: string; fullName: string };
}

/**
 * El cobro al que pertenece un lavado (059). `ticketCount > 1` = cuenta
 * mancomunada: anular o deshacer ese cobro los mueve a todos (RN-8).
 */
export interface TicketChargeRef {
  id: string;
  /** `C-0007`. */
  number: string;
  /** Cuántos lavados entraron en la misma cuenta. 1 es el caso normal. */
  ticketCount: number;
  /** Total de la cuenta entera, no el de este lavado. */
  total: string;
  /** Efectivo que entregó el cliente y vuelto que se le dio (RN-10). */
  cashTendered: string | null;
  changeGiven: string | null;
  /**
   * La venta suelta cobrada en la misma cuenta (066), `V-0003`. Deshacer el
   * cobro del lavado la anula también: la cuenta se deshace entera.
   */
  counterSale: { id: string; number: string } | null;
}

/** Un lavado, como lo ven las dos vistas. La de pista ignora `payments`. */
export interface Ticket {
  id: string;
  /** `CW-0014`. En pantalla se muestra como `#14` (RN-15). */
  number: string;
  status: WorkOrderStatus;
  /** Responsable del carro. `null` si se abrió solo con la placa (040). */
  customer: Customer | null;
  vehicle: VehicleWithOwner;
  bodyType: VehicleBodyType;
  items: TicketItem[];
  /** Suma de `items[].total`, con IVA incluido (RN-6, RN-14; 065 RN-6). */
  total: string;
  /** Quien abrió (003 RN-8). `null` = oficina. No cambia al reasignar. */
  washer: TicketWasher | null;
  /** Quien cobra comisión (009). 0 o 1 en escrituras nuevas (035). */
  washers: TicketWasher[];
  /**
   * Comisión congelada al cobrar. `null` en OPEN/READY y en PAID anteriores a
   * la spec 009.
   */
  commissionTotal: string | null;
  notes: string | null;
  /**
   * Los pagos de este lavado (059). Vacío mientras no se cobra; uno en el caso
   * normal; varios cuando el cobro se partió en métodos. Lo que trae cada fila
   * es lo que le tocó a **este** lavado, no el total de la cuenta.
   */
  payments: TicketPayment[];
  /** La cuenta que lo cobró. `null` mientras no se cobra. */
  charge: TicketChargeRef | null;
  /** ISO. `null` si nunca pasó a `WASHING` o volvió a `OPEN`. */
  washingStartedAt: string | null;
  /**
   * ISO de la **última** entrada a `READY`, según el historial de estados
   * (046). `null` si nunca llegó o si el lavado es anterior a ese historial.
   * Lo calcula el servidor: la web no lo infiere de `updatedAt` (049).
   */
  readyAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Un renglón de pago de la cuenta: un método, su monto (059 RN-3) y sus datos (069). */
export interface ChargePayment extends PaymentMethodDetails {
  id: string;
  method: PaymentMethod;
  amount: string;
}

/** Una línea de la venta suelta de una cuenta, resumida para el cobro (066). */
export interface ChargeSaleLine {
  name: string;
  /** Tres decimales. */
  quantity: string;
  unitPrice: string;
  /** `unitPrice × quantity`, dos decimales. */
  total: string;
}

/** La venta suelta que viaja en una cuenta (066): los productos sin lavado. */
export interface ChargeSaleRef {
  id: string;
  /** `V-0003`. */
  number: string;
  customerName: string | null;
  total: string;
  items: ChargeSaleLine[];
}

/**
 * Una cuenta de cobro (059, 066). Junta 0..N lavados y 0..1 venta suelta —al
 * menos uno de los dos— y 1..N pagos; el caso normal es un lavado y un pago.
 * Nace cobrada: no existe una cuenta a medio pagar (RN-2).
 */
export interface Charge {
  id: string;
  number: string;
  /** Suma de los lavados y la venta, igual a la suma de los pagos (RN-3). */
  total: string;
  /** Efectivo entregado y vuelto. `null` si no hubo efectivo o si pagó justo. */
  cashTendered: string | null;
  changeGiven: string | null;
  chargedAt: string;
  chargedBy: { id: string; fullName: string };
  payments: ChargePayment[];
  /** Los lavados ya cobrados, para que la pantalla no vuelva a pedirlos. */
  tickets: Ticket[];
  /** Los productos sueltos de la cuenta (066). `null` si solo lleva lavados. */
  counterSale: ChargeSaleRef | null;
}

// ============================================================================
// spec 065 — Listas paginadas
// ============================================================================

/**
 * Una página de una lista larga (kardex, artículos, ventas). `page` empieza en
 * 1; `total` es cuántas filas hay en todo el filtro, no en esta página. La
 * query es `pageQuerySchema` (`schemas.ts`).
 */
export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Lo que el mostrador quiere saber del día —o, con `customerId`, del historial
 * del cliente— contado sobre **todas** las filas de ese día, sin el recorte de
 * `status`, búsqueda ni filtros, y nunca sobre la página (102).
 */
export interface TicketListSummary {
  /** `OPEN` + `WASHING`. */
  queued: number;
  ready: number;
  paidCount: number;
  /** Suma de `total` de los `PAID`, cadena decimal. */
  paidTotal: string;
  /** Todo lo que no es `VOID`. */
  nonVoid: number;
  all: number;
}

/**
 * Las opciones de los filtros de la lista: lo que aparece en los lavados del
 * día con su `status` y búsqueda, antes de los filtros de carrocería,
 * servicio, empleado y pago.
 */
export interface TicketListFacets {
  bodyTypes: { id: string; name: string }[];
  /** `value` es el `serviceId` de la línea, o su nombre si no tiene servicio enlazado. */
  services: { value: string; label: string }[];
  washers: { id: string; fullName: string }[];
  /** Hay al menos un lavado sin empleado: el filtro ofrece «Sin asignar». */
  hasUnassigned: boolean;
}

/** Respuesta de `GET /carwash/tickets` (102): la página más el resumen y las opciones. */
export interface TicketListPage extends Page<Ticket> {
  summary: TicketListSummary;
  facets: TicketListFacets;
}

// ============================================================================
// spec 009 — Comisiones del lavado
// ============================================================================

/** Una fila del reporte de comisiones: lo que hay que pagarle a un empleado. */
export interface CommissionEmployeeRow {
  employeeId: string;
  fullName: string;
  isActive: boolean;
  /** Tickets PAID del rango en los que aparece. */
  ticketCount: number;
  /** Suma de `total / n` de esos tickets, cadena decimal. */
  salesAttributed: string;
  /** Suma de `CommissionEntry.amount`. */
  commission: string;
}

/** Tickets PAID del rango abiertos desde oficina sin empleado. */
export interface CommissionUnassigned {
  ticketCount: number;
  commission: string;
}

/** Respuesta de `GET /carwash/commissions`. */
export interface CommissionReport {
  /** Inicio del rango, `YYYY-MM-DD`, en `America/El_Salvador`. */
  from: string;
  /** Fin del rango, `YYYY-MM-DD`, inclusive. */
  to: string;
  /** Una página de las filas (102); `total` es cuántos empleados hay en el rango. */
  employees: Page<CommissionEmployeeRow>;
  unassigned: CommissionUnassigned;
  /** Suma de la comisión de **todos** los empleados del rango, no de la página. No incluye `unassigned`. */
  totalPayable: string;
}

/** Un lavado cobrado dentro del detalle de un empleado (spec 061). */
export interface CommissionWashLine {
  workOrderId: string;
  /** Folio completo, `CW-0014`. */
  ticketNumber: string;
  /** ISO 8601. */
  chargedAt: string;
  plate: string;
  /** Total del lavado, cadena decimal. */
  ticketTotal: string;
  /** Cuántos se repartieron el lavado. 1 salvo lavados anteriores a la 035. */
  washerCount: number;
  /** Su parte de `ticketTotal`. */
  salesAttributed: string;
  /** Su `CommissionEntry.amount`. */
  commission: string;
}

/** Respuesta de `GET /carwash/commissions/:employeeId` (spec 061). */
export interface CommissionEmployeeDetail {
  from: string;
  to: string;
  employee: { id: string; fullName: string; isActive: boolean };
  ticketCount: number;
  salesAttributed: string;
  commission: string;
  /** Más reciente primero, de a una página (102). Las cifras de arriba son del rango entero. */
  washes: Page<CommissionWashLine>;
}

// ============================================================================
// spec 067 — Rendimiento del lavado
//
// Comisiones, tiempos, extras y clientes fieles, del equipo o de un empleado.
// Solo cuentan empleados activos y lavados PAID con empleado asignado; las
// comisiones de inactivos siguen en el reporte de la 009.
// ============================================================================

/** Tiempo promedio de lavado de un tipo de carro. */
export interface PerformanceBodyTime {
  bodyTypeId: string;
  bodyTypeName: string;
  /** Lavados con tiempo: pasaron por «Lavando» y después por «Listo». */
  timedCount: number;
  /** Minutos, un decimal. `null` sin lavados medidos. */
  avgMinutes: number | null;
}

/** Un extra vendido: servicio de una categoría con `isExtra`. */
export interface PerformanceExtraCount {
  /** Nombre del servicio tal como quedó en la línea (snapshot). */
  serviceName: string;
  /** Veces que se vendió. */
  count: number;
  /** Suma de `unitPrice` de esas líneas, cadena decimal. */
  total: string;
}

/** Las cifras de un alcance: todo el equipo o un empleado. */
export interface PerformanceFigures {
  /** Lavados PAID del rango. */
  washCount: number;
  /** Suma de `total / n` de esos lavados, cadena decimal (igual que la 009). */
  salesAttributed: string;
  /** Suma de `CommissionEntry.amount`, cadena decimal. */
  commission: string;
  timedCount: number;
  /** Lavados sin tiempo: la oficina los pasó a «Listo» sin «Lavando». */
  untimedCount: number;
  /** Promedio simple de todos los lavados medidos, minutos con un decimal. */
  avgMinutes: number | null;
  /** Un elemento por tipo de carro activo, en su `sortOrder`. */
  byBodyType: PerformanceBodyTime[];
  /**
   * Minutos por lavado contra el promedio del equipo en el mismo tipo de
   * carro. Negativo = más rápido. `null` para el equipo y sin lavados medidos.
   */
  minutesVsTeam: number | null;
  /** Lavados con al menos un extra. */
  withExtrasCount: number;
  /** Suma de las líneas extra, cadena decimal. */
  extrasTotal: string;
  /** Más vendido primero. */
  extras: PerformanceExtraCount[];
  /** Clientes fieles: lavados del rango de fieles (`returnsFrom`–`returnsTo`). */
  measuredCount: number;
  /** De esos, cuántos carros volvieron dentro de 30 días. */
  returnedCount: number;
  /** Días promedio hasta la vuelta, un decimal. `null` si nadie volvió. */
  avgReturnDays: number | null;
}

/** Una fila por empleado activo con lavados en el rango o en el de fieles. */
export interface PerformanceEmployeeRow extends PerformanceFigures {
  employeeId: string;
  fullName: string;
}

/**
 * Los clientes fieles solo miden lavados cuyos 30 días ya pasaron. Si el
 * rango pide días más nuevos, el API lo corre hacia atrás con el mismo largo.
 */
export interface PerformanceReturnsRange {
  returnsFrom: string;
  returnsTo: string;
  /** `true` si no coincide con `from`–`to`. */
  returnsShifted: boolean;
}

/** Respuesta de `GET /carwash/performance?from&to`. */
export interface PerformanceReport extends PerformanceReturnsRange {
  from: string;
  to: string;
  team: PerformanceFigures;
  /** Por nombre, de a una página (102). `team` es de todos, no de la página. */
  employees: Page<PerformanceEmployeeRow>;
  /** Todos los empleados activos, por nombre: las opciones del selector «Ver». */
  activeEmployees: { id: string; fullName: string }[];
}

/** Un lavado cobrado del empleado, para Tiempos y Extras. */
export interface PerformanceWashLine {
  workOrderId: string;
  /** Folio completo, `CW-0014`. */
  ticketNumber: string;
  /** ISO 8601. */
  chargedAt: string;
  plate: string;
  bodyTypeId: string;
  bodyTypeName: string;
  /** Líneas de servicio que no son extra, unidas con « + ». */
  mainServiceName: string | null;
  extras: { serviceName: string; total: string }[];
  extrasTotal: string;
  /** Total del lavado, cadena decimal. */
  total: string;
  /** Minutos de «Lavando» a «Listo», un decimal. `null` = sin tiempo. */
  minutes: number | null;
  /** Contra el promedio del equipo para su tipo de carro. Negativo = más rápido. */
  minutesVsTeam: number | null;
}

/** Un lavado del rango de fieles y si el carro volvió. */
export interface PerformanceReturnLine {
  workOrderId: string;
  ticketNumber: string;
  chargedAt: string;
  plate: string;
  bodyTypeName: string;
  /** Días hasta el siguiente lavado del mismo carro, si fue dentro de 30. */
  returnedAfterDays: number | null;
  /** Quién tuvo asignado ese siguiente lavado; `null` si nadie o no volvió. */
  returnedWithName: string | null;
}

/** Respuesta de `GET /carwash/performance/:employeeId?from&to`. */
export interface PerformanceEmployeeDetail extends PerformanceReturnsRange {
  from: string;
  to: string;
  employee: { id: string; fullName: string };
  figures: PerformanceFigures;
  /** Las del equipo en el mismo rango, para comparar. */
  team: PerformanceFigures;
  /** Empleados activos con lavados en el rango: «el equipo promedia N». */
  teamEmployeeCount: number;
  /**
   * Lavados cobrados del rango, más reciente primero. Las tres listas son una
   * página (102) con el mismo `?page`: cada pestaña muestra una sola.
   */
  washes: Page<PerformanceWashLine>;
  /** Los de `washes` que llevaron al menos un extra (pestaña Extras). */
  extraWashes: Page<PerformanceWashLine>;
  /** Lavados del rango de fieles, más reciente primero. */
  returns: Page<PerformanceReturnLine>;
}

// ============================================================================
// spec 010 — Carwash cash
//
// Una caja fisica, un turno a la vez. Los montos viajan como cadena decimal.
// En OPEN, cashTotal / cardTotal / transferTotal / otherTotal / expectedCash van en vivo;
// countedCash y differenceCash quedan null hasta el cierre.
// ============================================================================

export type CashSessionStatus = 'OPEN' | 'CLOSED';

export interface CashSessionActor {
  id: string;
  fullName: string;
}

/** Un turno de caja, abierto o cerrado. */
export interface CashSession {
  id: string;
  status: CashSessionStatus;
  openingFloat: string;
  openedAt: string;
  openedBy: CashSessionActor;
  closedAt: string | null;
  closedBy: CashSessionActor | null;
  countedCash: string | null;
  cashTotal: string | null;
  cardTotal: string | null;
  transferTotal: string | null;
  /** Suma de los pagos `OTHER` (069 RN-7). No entra a `expectedCash`. */
  otherTotal: string | null;
  /**
   * `transferTotal` desglosado por cuenta (069 RN-7). Las transferencias sin
   * cuenta (anteriores a la 069) van en una fila con `bankAccountId: null`.
   * Vacío si el turno no tiene transferencias.
   */
  transferByAccount: CashSessionTransferLine[];
  expectedCash: string | null;
  differenceCash: string | null;
  notes: string | null;
  paymentCount: number;
}

/** Una fila del desglose de transferencias del turno (069 RN-7). */
export interface CashSessionTransferLine {
  /** `null` = «Sin cuenta»: transferencias anteriores a la 069. */
  bankAccountId: string | null;
  /** «Agrícola · Corriente · 0012345678», o «Sin cuenta». Lo arma el API. */
  label: string;
  total: string;
}

/**
 * Un cobro atado al turno. Los pagos anteriores a 010 no aparecen aca.
 *
 * Desde la 065 un pago es de un lavado **o** de una venta suelta: exactamente
 * uno de los dos pares (`workOrderId`/`ticketNumber` o
 * `counterSaleId`/`saleNumber`) viene lleno.
 */
export interface CashSessionPayment extends PaymentMethodDetails {
  id: string;
  workOrderId: string | null;
  /** `CW-0014`. */
  ticketNumber: string | null;
  counterSaleId: string | null;
  /** `V-0001`. */
  saleNumber: string | null;
  /** 105: el abono a una cuenta abierta. */
  tabId: string | null;
  /** `C-0012`. */
  tabNumber: string | null;
  method: PaymentMethod;
  amount: string;
  paidAt: string;
}

/**
 * Detalle de un turno: la sesion mas los pagos que le pertenecen, de a una
 * pagina (`?page&pageSize`, spec 102). Los totales de la sesion son del turno
 * entero.
 */
export interface CashSessionDetail extends CashSession {
  payments: Page<CashSessionPayment>;
  /** Todos los pagos `OTHER` del turno, para el desglose de «Otro» (069 RN-7). */
  otherPayments: CashSessionPayment[];
}

// ============================================================================
// spec 046 — Línea de tiempo de estados del lavado
// ============================================================================

/** Quién movió el estado, con el nombre congelado al momento del cambio (RN-4). */
export interface TicketTimelineActor {
  kind: 'user' | 'employee';
  name: string;
}

/**
 * Un tramo: el lavado entró a `status` en `enteredAt` y salió en `leftAt`.
 *
 * El último tramo queda abierto (`leftAt: null`): cuánto lleva ahí lo cuenta la
 * pantalla con su propio reloj, no el API (RN-5).
 */
export interface TicketTimelineSegment {
  id: string;
  status: WorkOrderStatus;
  /** ISO. */
  enteredAt: string;
  /** ISO. `null` si es el tramo actual. */
  leftAt: string | null;
  /** `null` si es el tramo actual. */
  durationSeconds: number | null;
  actor: TicketTimelineActor | null;
}

/**
 * Un precio que se cambió con el lavado ya listo, firmado (060). Los nombres
 * van congelados al momento del cambio, igual que en los tramos de estado
 * (046 RN-4): el historial cuenta lo que pasó, no cómo se llama hoy la gente.
 */
export interface TicketPriceChange {
  id: string;
  /** Nombre del servicio al momento del cambio. */
  serviceName: string;
  previousUnitPrice: string;
  unitPrice: string;
  reason: string;
  /** Quién firmó. */
  authorizedBy: string;
  /** ISO. */
  changedAt: string;
}

/** La historia completa de un lavado, del más viejo al más nuevo. */
export interface TicketTimeline {
  segments: TicketTimelineSegment[];
  /**
   * Los cambios de precio firmados (060), del más viejo al más nuevo. Vacío en
   * el caso normal: casi ningún lavado cambia de precio.
   */
  priceChanges: TicketPriceChange[];
  /** `false` en lavados anteriores a la spec 046: no hay nada que mostrar (RN-8). */
  recorded: boolean;
}
