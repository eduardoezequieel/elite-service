import type {
  CreateCustomerInput,
  CreateFloorTicketInput,
  Customer,
  CustomerMatch,
  FloorEmployeeOption,
  FloorLoginInput,
  FloorSessionResponse,
  PutWashersInput,
  ServiceDetail,
  Ticket,
  UpdateTicketInput,
  VehicleBodyType,
  VehicleWithOwner,
} from '@elite/shared';

import { apiFetch } from '@/lib/api';

/**
 * API de la **pista**. Todo cuelga de `/floor/*` y viaja con la cookie
 * `elite_floor_session`, distinta de la de oficina (RN-19).
 *
 * Acá no hay cobrar ni anular, y no es un olvido: el empleado no cobra (RN-10)
 * y no administra (RN-0). El backend tampoco expone esas rutas para la pista.
 */

export function floorLogin(input: FloorLoginInput): Promise<FloorSessionResponse> {
  return apiFetch<FloorSessionResponse>('/floor/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function floorLogout(): Promise<void> {
  return apiFetch<void>('/floor/logout', { method: 'POST' });
}

export function getFloorSession(): Promise<FloorSessionResponse> {
  return apiFetch<FloorSessionResponse>('/floor/me');
}

function query(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== undefined),
  ).toString();

  return search === '' ? '' : `?${search}`;
}

/** La fila del día: lo que falta hacer. Sin cobrados ni anulados. */
export function listFloorTickets(
  params: { q?: string; date?: string } = {},
): Promise<Ticket[]> {
  return apiFetch<Ticket[]>(`/floor/tickets${query(params)}`);
}

export function getFloorTicket(id: string): Promise<Ticket> {
  return apiFetch<Ticket>(`/floor/tickets/${id}`);
}

export function createFloorTicket(input: CreateFloorTicketInput): Promise<Ticket> {
  return apiFetch<Ticket>('/floor/tickets', { method: 'POST', body: JSON.stringify(input) });
}

export function updateFloorTicket(id: string, input: UpdateTicketInput): Promise<Ticket> {
  return apiFetch<Ticket>(`/floor/tickets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function markFloorReady(id: string): Promise<Ticket> {
  return apiFetch<Ticket>(`/floor/tickets/${id}/ready`, { method: 'POST' });
}

export function reopenFloorTicket(id: string): Promise<Ticket> {
  return apiFetch<Ticket>(`/floor/tickets/${id}/reopen`, { method: 'POST' });
}

export function listFloorEmployees(): Promise<FloorEmployeeOption[]> {
  return apiFetch<FloorEmployeeOption[]>('/floor/employees');
}

export function putFloorTicketWashers(id: string, input: PutWashersInput): Promise<Ticket> {
  return apiFetch<Ticket>(`/floor/tickets/${id}/washers`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function listFloorServices(): Promise<ServiceDetail[]> {
  return apiFetch<ServiceDetail[]>('/floor/services');
}

export function listFloorBodyTypes(): Promise<VehicleBodyType[]> {
  return apiFetch<VehicleBodyType[]>('/floor/vehicle-body-types');
}

export function listFloorVehicles(q?: string): Promise<VehicleWithOwner[]> {
  const search = q === undefined || q === '' ? '' : `?q=${encodeURIComponent(q)}`;

  return apiFetch<VehicleWithOwner[]>(`/floor/vehicles${search}`);
}

export function listFloorCustomers(q?: string): Promise<Customer[]> {
  const search = q === undefined || q === '' ? '' : `?q=${encodeURIComponent(q)}`;

  return apiFetch<Customer[]>(`/floor/customers${search}`);
}

/**
 * ¿Ya existe alguien así? (004 RN-1). La pista pregunta antes de crear, igual
 * que la oficina: lo que no puede es editar ni listar clientes (RN-5).
 */
export function matchFloorCustomer(
  fullName: string,
  phone?: string,
): Promise<CustomerMatch | null> {
  const search = new URLSearchParams({ fullName });

  if (phone !== undefined && phone !== '') search.set('phone', phone);

  return apiFetch<CustomerMatch | null>(`/floor/customers/match?${search.toString()}`);
}

export function createFloorCustomer(input: CreateCustomerInput): Promise<Customer> {
  return apiFetch<Customer>('/floor/customers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
