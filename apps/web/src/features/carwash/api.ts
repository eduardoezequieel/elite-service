import type {
  CashSession,
  CashSessionDetail,
  ChargeTicketInput,
  ReverseTicketInput,
  CloseCashInput,
  CommissionReport,
  CreateOfficeTicketInput,
  Customer,
  OpenCashInput,
  PublicEmployee,
  PutWashersInput,
  ServiceDetail,
  Ticket,
  UpdateTicketInput,
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

/** Alta de emergencia desde el mostrador, con lavador opcional (RN-7). */
export function createTicket(input: CreateOfficeTicketInput): Promise<Ticket> {
  return apiFetch<Ticket>('/carwash/tickets', { method: 'POST', body: JSON.stringify(input) });
}

export function updateTicket(id: string, input: UpdateTicketInput): Promise<Ticket> {
  return apiFetch<Ticket>(`/carwash/tickets/${id}`, {
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

/** Cobro. Solo desde `READY` y por el total exacto (RN-10). */
export function chargeTicket(id: string, input: ChargeTicketInput): Promise<Ticket> {
  return apiFetch<Ticket>(`/carwash/tickets/${id}/charge`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function voidTicket(id: string): Promise<Ticket> {
  return apiFetch<Ticket>(`/carwash/tickets/${id}/void`, { method: 'POST' });
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

export function listVehicles(q?: string): Promise<VehicleWithOwner[]> {
  return apiFetch<VehicleWithOwner[]>(`/vehicles${query({ q })}`);
}

export function updateVehicle(
  id: string,
  input: UpdateVehicleInput,
): Promise<VehicleWithOwner> {
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
