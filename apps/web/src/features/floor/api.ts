import type {
  CreateCustomerInput,
  CreateFloorTicketInput,
  Customer,
  FloorLoginInput,
  FloorSessionResponse,
  ServiceDetail,
  Ticket,
  UpdateTicketInput,
  VehicleBodyType,
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

/** La fila del día: lo que falta hacer. Sin cobrados ni anulados. */
export function listFloorTickets(): Promise<Ticket[]> {
  return apiFetch<Ticket[]>('/floor/tickets');
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

export function listFloorServices(): Promise<ServiceDetail[]> {
  return apiFetch<ServiceDetail[]>('/floor/services');
}

export function listFloorBodyTypes(): Promise<VehicleBodyType[]> {
  return apiFetch<VehicleBodyType[]>('/floor/vehicle-body-types');
}

export function listFloorCustomers(q?: string): Promise<Customer[]> {
  const search = q === undefined || q === '' ? '' : `?q=${encodeURIComponent(q)}`;

  return apiFetch<Customer[]>(`/floor/customers${search}`);
}

export function createFloorCustomer(input: CreateCustomerInput): Promise<Customer> {
  return apiFetch<Customer>('/floor/customers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
