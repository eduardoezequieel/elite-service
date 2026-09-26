import type {
  AuthorizePriceInput,
  CashSession,
  CashSessionDetail,
  Charge,
  CreateChargeInput,
  VoidChargeInput,
  ReverseTicketInput,
  SetTicketResponsibleInput,
  SetTicketStatusInput,
  VoidTicketInput,
  CloseCashInput,
  CommissionEmployeeDetail,
  CommissionReport,
  CreateOfficeTicketInput,
  Customer,
  InventoryItemOption,
  OpenCashInput,
  PerformanceEmployeeDetail,
  PerformanceReport,
  PublicEmployee,
  PutWashersInput,
  ServiceDetail,
  Ticket,
  TicketTimeline,
  UpdateTicketInput,
  UpdateTicketNotesInput,
  UpdateVehicleInput,
  VehicleBodyType,
  VehicleWithOwner,
} from '@elite/shared';

import { apiFetch } from '@/lib/api';

/**
 * API de lavados desde la **oficina** (sesion `user` + permisos).
 *
 * Las rutas de pista son otras (`/floor/*`) y viven en `features/floor/api.ts`:
 * separarlas no es orden por gusto, es que una pantalla de oficina no deberia
 * poder llamar sin querer a una ruta que espera la cookie de pista.
 */

function query(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== undefined),
  ).toString();

  return search === '' ? '' : `?${search}`;
}

/**
 * La fila del día, o —con `customerId`— el historial de un cliente: sin
 * recorte por día, en cualquier estado y solo los últimos (004).
 */
export function listTickets(
  params: { status?: string; date?: string; customerId?: string; q?: string } = {},
): Promise<Ticket[]> {
  return apiFetch<Ticket[]>(`/carwash/tickets${query(params)}`);
}

export function getTicket(id: string): Promise<Ticket> {
  return apiFetch<Ticket>(`/carwash/tickets/${id}`);
}

/** La historia de estados del lavado. Pide `carwash.audit` (046). */
export function getTicketTimeline(id: string): Promise<TicketTimeline> {
  return apiFetch<TicketTimeline>(`/carwash/tickets/${id}/timeline`);
}

/** Alta de emergencia desde el mostrador, con empleado opcional (RN-7). */
export function createTicket(input: CreateOfficeTicketInput): Promise<Ticket> {
  return apiFetch<Ticket>('/carwash/tickets', { method: 'POST', body: JSON.stringify(input) });
}

export function updateTicket(id: string, input: UpdateTicketInput): Promise<Ticket> {
  return apiFetch<Ticket>(`/carwash/tickets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/** La nota del ticket listo, sin `carwash.manage` (041). */
export function updateTicketNotes(id: string, input: UpdateTicketNotesInput): Promise<Ticket> {
  return apiFetch<Ticket>(`/carwash/tickets/${id}/notes`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function markReady(id: string): Promise<Ticket> {
  return apiFetch<Ticket>(`/carwash/tickets/${id}/ready`, { method: 'POST' });
}

export function reopenTicket(id: string): Promise<Ticket> {
  return apiFetch<Ticket>(`/carwash/tickets/${id}/reopen`, { method: 'POST' });
}

export function setTicketStatus(id: string, input: SetTicketStatusInput): Promise<Ticket> {
  return apiFetch<Ticket>(`/carwash/tickets/${id}/status`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Cobrar una cuenta (059). Uno o varios lavados, uno o varios pagos: el caso
 * normal —un lavado, un pago— viaja por acá igual que el mancomunado, así que
 * la web no tiene dos caminos para cobrar.
 *
 * `POST /carwash/tickets/:id/charge` sigue existiendo por compatibilidad, pero
 * ninguna pantalla lo llama.
 */
export function createCharge(input: CreateChargeInput): Promise<Charge> {
  return apiFetch<Charge>('/carwash/charges', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Deshacer la cuenta entera: no se deshace un lavado suelto (059 RN-8). */
export function voidCharge(id: string, input: VoidChargeInput): Promise<void> {
  return apiFetch<void>(`/carwash/charges/${id}/void`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Cambiar el precio de una línea con el lavado ya listo (060). Lo aplica la
 * firma del administrador, no la sesión de quien está en la pantalla.
 */
export function authorizeItemPrice(
  ticketId: string,
  itemId: string,
  input: AuthorizePriceInput,
): Promise<Ticket> {
  return apiFetch<Ticket>(`/carwash/tickets/${ticketId}/items/${itemId}/price`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function setTicketResponsible(
  id: string,
  input: SetTicketResponsibleInput,
): Promise<Ticket> {
  return apiFetch<Ticket>(`/carwash/tickets/${id}/responsible`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function voidTicket(id: string, input: VoidTicketInput): Promise<Ticket> {
  return apiFetch<Ticket>(`/carwash/tickets/${id}/void`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function reverseTicket(id: string, input: ReverseTicketInput): Promise<Ticket> {
  return apiFetch<Ticket>(`/carwash/tickets/${id}/reverse`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// --- catalogos que las pantallas de oficina necesitan para armar un ticket ---

export function listBodyTypes(): Promise<VehicleBodyType[]> {
  return apiFetch<VehicleBodyType[]>('/vehicle-body-types');
}

export function listServices(): Promise<ServiceDetail[]> {
  return apiFetch<ServiceDetail[]>('/services');
}

/**
 * Los productos que se pueden sumar a un lavado (065): activos, sin costos y
 * con su existencia para el «Hay N». Pide `carwash.read`, no `inventory.read`:
 * quien arma el lavado no tiene por qué ver el inventario.
 */
export function listProductOptions(search?: string): Promise<InventoryItemOption[]> {
  return apiFetch<InventoryItemOption[]>(
    `/carwash/inventory-items${query({ search: search?.trim() || undefined })}`,
  );
}

export function listVehicles(q?: string): Promise<VehicleWithOwner[]> {
  return apiFetch<VehicleWithOwner[]>(`/vehicles${query({ q })}`);
}

export function updateVehicle(id: string, input: UpdateVehicleInput): Promise<VehicleWithOwner> {
  return apiFetch<VehicleWithOwner>(`/vehicles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function listCustomers(q?: string): Promise<Customer[]> {
  return apiFetch<Customer[]>(`/customers${query({ q })}`);
}

export function listEmployees(): Promise<PublicEmployee[]> {
  return apiFetch<PublicEmployee[]>('/employees');
}

export function putTicketWashers(id: string, input: PutWashersInput): Promise<Ticket> {
  return apiFetch<Ticket>(`/carwash/tickets/${id}/washers`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function getCommissions(
  params: { from?: string; to?: string } = {},
): Promise<CommissionReport> {
  return apiFetch<CommissionReport>(`/carwash/commissions${query(params)}`);
}

export function getEmployeeCommissions(
  employeeId: string,
  params: { from?: string; to?: string } = {},
): Promise<CommissionEmployeeDetail> {
  return apiFetch<CommissionEmployeeDetail>(
    `/carwash/commissions/${encodeURIComponent(employeeId)}${query(params)}`,
  );
}

// --- caja (spec 010) ---

export function getCurrentCashSession(): Promise<CashSession | null> {
  return apiFetch<CashSession | null>('/carwash/cash/current');
}

export function listCashSessions(): Promise<CashSession[]> {
  return apiFetch<CashSession[]>('/carwash/cash/sessions');
}

export function getCashSession(id: string): Promise<CashSessionDetail> {
  return apiFetch<CashSessionDetail>(`/carwash/cash/sessions/${id}`);
}

export function openCash(input: OpenCashInput): Promise<CashSession> {
  return apiFetch<CashSession>('/carwash/cash/open', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function closeCash(input: CloseCashInput): Promise<CashSession> {
  return apiFetch<CashSession>('/carwash/cash/close', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// --- rendimiento (spec 067) ---

export function getPerformance(
  params: { from?: string; to?: string } = {},
): Promise<PerformanceReport> {
  return apiFetch<PerformanceReport>(`/carwash/performance${query(params)}`);
}

export function getEmployeePerformance(
  employeeId: string,
  params: { from?: string; to?: string } = {},
): Promise<PerformanceEmployeeDetail> {
  return apiFetch<PerformanceEmployeeDetail>(
    `/carwash/performance/${encodeURIComponent(employeeId)}${query(params)}`,
  );
}
