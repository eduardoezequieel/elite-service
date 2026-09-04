import type { FloorEmployeeOption, Ticket, WorkOrderStatus } from '@elite/shared';

import type { CommissionEntryRecord, UnassignedCommissionRecord } from '../../domain/commission';
import type { Cents } from '../../domain/money';

/** Una linea a persistir, ya resuelta por el dominio. */
export interface TicketItemData {
  serviceId: string;
  serviceCode: string;
  serviceName: string;
  catalogPrice: Cents;
  unitPrice: Cents;
  taxRate: string;
  sortOrder: number;
}

/** Todo lo que hace falta para insertar un ticket, ya validado. */
export interface NewTicketData {
  customerId: string;
  vehicleId: string;
  bodyTypeId: string;
  notes?: string;
  /** Quien lo abrio. No cambia al sumar lavadores (003 RN-8, 009 RN-3). */
  openedByEmployeeId: string | null;
  openedByUserId: string | null;
  items: TicketItemData[];
  /** Conjunto que cobra comision. Vacio = «Oficina». */
  washerIds: string[];
}

export interface TicketChanges {
  bodyTypeId?: string;
  notes?: string;
  /** Si viene, reemplaza las lineas completas. */
  items?: TicketItemData[];
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
}

export interface ChargeData {
  method: 'CASH' | 'CARD' | 'TRANSFER';
  amount: Cents;
  userId: string;
  cashSessionId: string;
  commissionTotal: Cents;
  entries: { employeeId: string; amount: Cents }[];
}

export interface CommissionRange {
  from: string;
  to: string;
}

export interface TicketRepository {
  list(filter: TicketFilter): Promise<Ticket[]>;
  findById(id: string): Promise<Ticket | null>;
  create(data: NewTicketData): Promise<Ticket>;
  update(id: string, changes: TicketChanges): Promise<Ticket>;
  setStatus(id: string, status: WorkOrderStatus): Promise<Ticket>;
  charge(id: string, data: ChargeData): Promise<Ticket>;
  replaceWashers(id: string, employeeIds: string[]): Promise<Ticket>;
  /** Ids del conjunto que existen y estan activos. */
  findActiveEmployeeIds(ids: string[]): Promise<string[]>;
  listActiveEmployees(): Promise<FloorEmployeeOption[]>;
  listCommissionSnapshot(range: CommissionRange): Promise<{
    entries: CommissionEntryRecord[];
    unassigned: UnassignedCommissionRecord[];
  }>;
}

export const TICKET_REPOSITORY = Symbol('carwash.TicketRepository');
