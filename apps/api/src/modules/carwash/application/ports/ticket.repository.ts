import type {
  CarwashEventActor,
  FloorEmployeeOption,
  InventoryLowStockPayload,
  PageQuery,
  Ticket,
  TicketListPage,
  TicketItemKind,
  WorkOrderStatus,
} from '@elite/shared';

import type { NewCustomerData } from '../../../customers/application/ports/customer.repository';
import type { Milli } from '../../../inventory/domain/stock';
import type { NewVehicleData } from '../../../vehicles/application/ports/vehicle.repository';

import type {
  CommissionEntryRecord,
  CommissionWashRecord,
  UnassignedCommissionRecord,
} from '../../domain/commission';
import type { Cents } from '../../domain/money';
import type { TicketListFilters } from '../../domain/ticket-list';
import type { StatusEventRecord } from '../../domain/ticket-timeline';

/**
 * Una linea a persistir, ya resuelta por el dominio. Servicio o producto
 * (065): `serviceCode` / `serviceName` son el snapshot de cualquiera de los dos.
 */
export interface TicketItemData {
  kind: TicketItemKind;
  /** Solo en `SERVICE`. */
  serviceId: string | null;
  /** Solo en `PRODUCT`. */
  inventoryItemId: string | null;
  serviceCode: string;
  serviceName: string;
  catalogPrice: Cents;
  unitPrice: Cents;
  /** En milesimas. Un servicio es siempre una unidad (1000). */
  quantity: Milli;
  taxRate: string;
  sortOrder: number;
  /** Combo del que salio la linea (104); `null` en una linea suelta. */
  comboId: string | null;
  /** Snapshot del nombre del combo al expandirlo (104 RN-4). */
  comboName: string | null;
}

/**
 * Lo que devuelve una escritura que puede mover inventario (065): el ticket y
 * los avisos de minimo que cruzo. Se publican **despues** del commit, y los
 * publica el caso de uso, no el repositorio.
 */
export interface TicketWrite {
  ticket: Ticket;
  lowStock: InventoryLowStockPayload[];
}

/**
 * La edicion de lineas encontro el lavado fuera de `OPEN` al bloquearlo: otra
 * pantalla lo movio entre la lectura y la escritura. No se toca nada.
 */
export class TicketNotEditableError extends Error {
  constructor(readonly ticketId: string) {
    super('Ticket is no longer open');
    this.name = 'TicketNotEditableError';
  }
}

/**
 * La placa del vehiculo a crear ya la tomo otra alta entre la consulta y la
 * insercion (079): la regla de placa tomada se chequea antes, pero dos altas
 * simultaneas de la misma placa solo chocan en el unico de la base.
 */
export class VehiclePlateTakenError extends Error {
  constructor(readonly plate: string) {
    super('Vehicle plate is already taken');
    this.name = 'VehiclePlateTakenError';
  }
}

/**
 * Al bloquear el lavado, su estado ya no era uno de los esperados: otra
 * pantalla lo movio entre la lectura y la escritura (090 RN-2). No se escribio
 * nada. `current` es el estado que tenia al bloquearlo.
 */
export class TicketStatusChangedError extends Error {
  constructor(
    readonly ticketId: string,
    readonly current: WorkOrderStatus,
  ) {
    super('Ticket status changed before the write');
    this.name = 'TicketStatusChangedError';
  }
}

/** El lavado sin cobrar que ocupa un carro, tal como sale en `details` (090). */
export interface UnchargedWash {
  id: string;
  number: string;
  plate: string;
  status: WorkOrderStatus;
}

/**
 * El carro ya tiene un lavado sin cobrar (090 RN-1). Lo dice el unico parcial
 * de la base, en un alta o un reverso que gano otra pantalla por poco; o el
 * reverso, que lo mira antes de volver a `READY`. `ticket` es ese otro lavado
 * cuando se sabe cual es.
 */
export class VehicleBusyError extends Error {
  constructor(readonly ticket: UnchargedWash | null) {
    super('Vehicle already has an uncharged wash');
    this.name = 'VehicleBusyError';
  }
}

/** Un cambio de estado y los estados desde los que vale (090 RN-2). */
export interface StatusMove {
  from: readonly WorkOrderStatus[];
  to: WorkOrderStatus;
}

/**
 * El responsable del alta (040): uno que ya existe, uno a crear en la misma
 * transaccion que el lavado, o ninguno.
 */
export type TicketIntakeCustomer = { id: string } | { create: NewCustomerData } | null;

/**
 * El vehiculo del alta (012). Uno conocido —con `claimOwner` si no tenia
 * responsable y el alta trae uno— o uno nuevo, que nace con el responsable del
 * alta como dueno.
 */
export type TicketIntakeVehicle =
  { id: string; claimOwner: boolean } | { create: Omit<NewVehicleData, 'customerId'> };

/**
 * Todo lo que hace falta para abrir un ticket, ya validado. Cliente, vehiculo
 * y lavado se escriben en **una** transaccion (079): si el kardex rechaza, no
 * queda ni cliente ni vehiculo.
 */
export interface NewTicketData {
  customer: TicketIntakeCustomer;
  vehicle: TicketIntakeVehicle;
  bodyTypeId: string;
  notes?: string;
  /** Quien lo abrio. No cambia al reasignar (003 RN-8). */
  openedByEmployeeId: string | null;
  openedByUserId: string | null;
  items: TicketItemData[];
  /** Quien cobra comision. 0 o 1 en escrituras nuevas (035). */
  washerIds: string[];
}

export interface TicketChanges {
  bodyTypeId?: string;
  notes?: string | null;
  /** Si viene, reemplaza las lineas completas. */
  items?: TicketItemData[];
  /** Pegar un responsable al ticket (040). */
  customerId?: string | null;
}

/** Filtro de la fila. Sin fecha, es el dia de hoy. */
export interface TicketFilter {
  statuses?: WorkOrderStatus[];
  /** Dia en `America/El_Salvador`, formato `YYYY-MM-DD`. */
  date?: string;
  /**
   * El historial de un cliente. No se recorta por dia (`planTicketQuery`,
   * 004): la ficha del cliente pregunta por su historia, no por lo que entro
   * hoy. La acota la pagina (102).
   */
  customerId?: string;
  /** Busqueda libre por placa, numero de referencia o nombre de cliente (014). */
  q?: string;
  /**
   * Pista: solo tickets a cargo de este empleado (036). Ausente = no recorta.
   * Un ticket sin asignado no entra.
   */
  assignedEmployeeId?: string;
}

/**
 * La lista de oficina (102): la fila o el historial, con los filtros del
 * popover y la pagina. La pista no pasa por aca.
 */
export interface TicketPageFilter
  extends Omit<TicketFilter, 'assignedEmployeeId'>, TicketListFilters, PageQuery {}

/**
 * La firma de un precio cambiado desde `READY` (060 RN-1).
 *
 * `authorizedByName` se copia a la fila del historial: el nombre de quien
 * autorizo es lo que el dueno revisa al cierre, y tiene que sobrevivir a que a
 * esa persona la renombren o la den de baja (046 RN-4).
 */
export interface PriceAuthorizationData {
  itemId: string;
  unitPrice: Cents;
  previousUnitPrice: Cents;
  reason: string;
  authorizedByUserId: string;
  authorizedByName: string;
}

export interface CommissionRange {
  from: string;
  to: string;
}

/**
 * Quien provoco el cambio de estado, para la fila del historial (046 RN-3).
 *
 * Es el mismo actor que viaja por el stream (042) y sale del mismo lugar: la
 * sesion que el guard ya resolvio. `null` cuando no se puede atribuir.
 */
export type StatusActor = CarwashEventActor | null;

export interface TicketRepository {
  /** La pista (036): la fila completa del empleado, sin pagina. */
  list(filter: TicketFilter): Promise<Ticket[]>;
  /**
   * Una pagina de la lista de oficina, con el resumen de la base y las
   * opciones de filtro (`domain/ticket-list.ts`, 102). Orden: mas nuevo
   * primero, despues `id`.
   */
  listPage(filter: TicketPageFilter): Promise<TicketListPage>;
  findById(id: string): Promise<Ticket | null>;
  /**
   * Las lineas guardadas del lavado tal como se escribieron, con su IVA, en
   * `sortOrder` (104): la edicion conserva asi las lineas de un combo que no
   * cambia sin recotizarlas.
   */
  listLines(id: string): Promise<TicketItemData[]>;
  /**
   * Crea el cliente y el vehiculo que el alta traiga nuevos (o le pone dueno
   * al vehiculo que no tenia), el lavado, la fila `null → OPEN` del historial
   * (046 RN-2) y un `SALE` por cada producto (065 RN-4), todo en la misma
   * transaccion (079).
   *
   * @throws los errores de `inventory/domain/stock` si un producto no se puede
   * vender (no existe, inactivo, insumo, sin existencia): no se crea nada, ni
   * cliente ni vehiculo. `VehiclePlateTakenError` si la placa nueva choco.
   * `VehicleBusyError` si el carro ya tenia otro lavado sin cobrar (090).
   */
  create(data: NewTicketData, actor: StatusActor): Promise<TicketWrite>;
  /**
   * El lavado sin cobrar (`OPEN`, `WASHING` o `READY`) de ese carro, o `null`
   * (090 RN-1). Hay uno como maximo.
   */
  findUnchargedOfVehicle(vehicleId: string): Promise<Ticket | null>;
  /**
   * Si trae `items`, reemplaza las lineas y mueve el inventario por la
   * diferencia de cada producto (065 RN-4), en la misma transaccion y con el
   * lavado bloqueado. `actor` queda como autor de esos movimientos.
   *
   * @throws TicketNotEditableError si al bloquearlo el lavado ya no esta `OPEN`;
   * los errores de `inventory/domain/stock` si un producto no se puede vender.
   */
  update(id: string, changes: TicketChanges, actor?: StatusActor): Promise<TicketWrite>;
  /**
   * Mueve el estado y escribe su fila de historial en la misma transaccion: si
   * no se puede auditar, no se mueve (046 RN-1). Al pasar a `VOID` repone cada
   * producto con un `SALE_RETURN` en la misma transaccion (065 RN-5); ningun
   * otro estado toca el inventario.
   *
   * @throws TicketStatusChangedError si, con el lavado bloqueado, su estado no
   * esta en `move.from` (090 RN-2).
   */
  setStatus(id: string, move: StatusMove, actor: StatusActor): Promise<Ticket>;
  /**
   * Cambia el precio de una linea y deja su firma (060). Escribe tambien la
   * fila del historial, en la misma transaccion: un precio cambiado que no se
   * puede auditar no sirve de nada.
   *
   * @throws TicketStatusChangedError si al bloquearlo ya estaba `PAID` o `VOID`.
   */
  authorizePrice(id: string, data: PriceAuthorizationData): Promise<Ticket>;
  /** Historial crudo, en cualquier orden. El dominio lo ordena (046). */
  listStatusEvents(id: string): Promise<StatusEventRecord[]>;
  /**
   * Agrega una linea a la nota con el lavado bloqueado (079): dos notas a la
   * vez se concatenan, no se pisan.
   */
  appendNote(id: string, line: string): Promise<Ticket>;
  /** @throws TicketStatusChangedError si al bloquearlo ya estaba `PAID` o `VOID`. */
  replaceWashers(id: string, employeeIds: string[]): Promise<Ticket>;
  /**
   * Los lavados en `WASHING` a cargo de este empleado (071). No recorta por
   * dia: uno de ayer que nadie cerro tambien lo tiene ocupado.
   */
  listWashingOf(employeeId: string): Promise<Ticket[]>;
  /** Ids del conjunto que existen y estan activos. */
  findActiveEmployeeIds(ids: string[]): Promise<string[]>;
  listActiveEmployees(): Promise<FloorEmployeeOption[]>;
  listCommissionSnapshot(range: CommissionRange): Promise<{
    entries: CommissionEntryRecord[];
    unassigned: UnassignedCommissionRecord[];
  }>;
  /** Cualquier empleado, activo o no: un inactivo sigue teniendo comisiones (061). */
  findCommissionEmployee(id: string): Promise<{
    id: string;
    fullName: string;
    isActive: boolean;
  } | null>;
  /** Las entradas de un empleado en el rango, con número, cobro y placa (061). */
  listEmployeeCommissionWashes(
    employeeId: string,
    range: CommissionRange,
  ): Promise<CommissionWashRecord[]>;
}

export const TICKET_REPOSITORY = Symbol('carwash.TicketRepository');
