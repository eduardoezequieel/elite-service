import type {
  CarwashEventActor,
  FloorEmployeeOption,
  InventoryLowStockPayload,
  Ticket,
  TicketItemKind,
  WorkOrderStatus,
} from '@elite/shared';

import type { Milli } from '../../../inventory/domain/stock';

import type {
  CommissionEntryRecord,
  CommissionWashRecord,
  UnassignedCommissionRecord,
} from '../../domain/commission';
import type { Cents } from '../../domain/money';
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

/** Todo lo que hace falta para insertar un ticket, ya validado. */
export interface NewTicketData {
  customerId: string | null;
  vehicleId: string;
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
   * El historial de un cliente. No se recorta por dia y trae los ultimos
   * (`planTicketQuery`, 004): la ficha del cliente pregunta por su historia,
   * no por lo que entro hoy.
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
  list(filter: TicketFilter): Promise<Ticket[]>;
  findById(id: string): Promise<Ticket | null>;
  /**
   * Deja escrita la fila `null → OPEN` del historial (046 RN-2) y un `SALE` por
   * cada producto (065 RN-4), todo en la misma transaccion.
   *
   * @throws los errores de `inventory/domain/stock` si un producto no se puede
   * vender (no existe, inactivo, insumo, sin existencia): no se crea nada.
   */
  create(data: NewTicketData, actor: StatusActor): Promise<TicketWrite>;
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
   */
  setStatus(id: string, status: WorkOrderStatus, actor: StatusActor): Promise<Ticket>;
  /**
   * Cambia el precio de una linea y deja su firma (060). Escribe tambien la
   * fila del historial, en la misma transaccion: un precio cambiado que no se
   * puede auditar no sirve de nada.
   */
  authorizePrice(id: string, data: PriceAuthorizationData): Promise<Ticket>;
  /** Historial crudo, en cualquier orden. El dominio lo ordena (046). */
  listStatusEvents(id: string): Promise<StatusEventRecord[]>;
  appendNote(id: string, line: string): Promise<Ticket>;
  replaceWashers(id: string, employeeIds: string[]): Promise<Ticket>;
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
