import type {
  CreateCustomerInput,
  CreateVehicleInput,
  Customer,
  CustomerMatch,
  UpdateCustomerInput,
  UpdateVehicleInput,
  VehicleWithOwner,
} from '@elite/shared';

import { apiFetch } from '@/lib/api';

/**
 * API de clientes desde la **oficina** (sesión `user` + permisos).
 *
 * La pista tiene las suyas en `features/floor/api.ts`: puede buscar y dar de
 * alta al vuelo, pero no listar ni editar (004 RN-5).
 */

function query(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== undefined),
  ).toString();

  return search === '' ? '' : `?${search}`;
}

/**
 * Por omisión el API devuelve solo activos. La pantalla de Clientes pide
 * `activeOnly=false`, que es la única forma de volver a ver a alguien dado de
 * baja para reactivarlo (RN-4).
 */
export function listCustomers(
  params: { q?: string; activeOnly?: boolean } = {},
): Promise<Customer[]> {
  return apiFetch<Customer[]>(
    `/customers${query({
      q: params.q === '' ? undefined : params.q,
      activeOnly: params.activeOnly === undefined ? undefined : String(params.activeOnly),
    })}`,
  );
}

export function getCustomer(id: string): Promise<Customer> {
  return apiFetch<Customer>(`/customers/${id}`);
}

/** ¿Ya existe alguien así? Devuelve `null` cuando no, que es lo habitual (RN-1). */
export function matchCustomer(fullName: string, phone?: string): Promise<CustomerMatch | null> {
  return apiFetch<CustomerMatch | null>(
    `/customers/match${query({ fullName, phone: phone === '' ? undefined : phone })}`,
  );
}

export function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  return apiFetch<Customer>('/customers', { method: 'POST', body: JSON.stringify(input) });
}

/** Sin `DELETE`: los clientes se desactivan (003 RN-13). */
export function updateCustomer(id: string, input: UpdateCustomerInput): Promise<Customer> {
  return apiFetch<Customer>(`/customers/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

/** Los carros que hoy son de ese cliente, para su ficha. */
export function listCustomerVehicles(customerId: string): Promise<VehicleWithOwner[]> {
  return apiFetch<VehicleWithOwner[]>(`/vehicles${query({ customerId })}`);
}

export function createVehicle(input: CreateVehicleInput): Promise<VehicleWithOwner> {
  return apiFetch<VehicleWithOwner>('/vehicles', { method: 'POST', body: JSON.stringify(input) });
}

export function updateVehicle(id: string, input: UpdateVehicleInput): Promise<VehicleWithOwner> {
  return apiFetch<VehicleWithOwner>(`/vehicles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
