import type {
  CreateCustomerInput,
  CreateVehicleInput,
  Customer,
  CustomerMatch,
  UpdateCustomerInput,
  UpdateVehicleInput,
  VehicleWithOwner,
  Page,
} from '@elite/shared';
import { MAX_PAGE_SIZE } from '@elite/shared';

import { apiFetch } from '@/lib/api';

/**
 * API de clientes desde la **oficina** (sesión `user` + permisos).
 *
 * La pista tiene las suyas en `features/floor/api.ts`: puede buscar y dar de
 * alta al vuelo, pero no listar ni editar (004 RN-5).
 */

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams(
    Object.entries(params)
      .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
      .map(([key, value]) => [key, String(value)]),
  ).toString();

  return search === '' ? '' : `?${search}`;
}

/** Una página de los clientes que coincidan: no hay estado que esconda a nadie (048, 102). */
export function listCustomersPage(
  params: { q?: string; page?: number; pageSize?: number } = {},
): Promise<Page<Customer>> {
  return apiFetch<Page<Customer>>(
    `/customers${query({
      q: params.q === '' ? undefined : params.q,
      page: params.page,
      pageSize: params.pageSize,
    })}`,
  );
}

/** Las sugerencias de un combobox: `q` y la primera página (102). */
export async function listCustomers(params: { q?: string } = {}): Promise<Customer[]> {
  return (await listCustomersPage({ q: params.q, page: 1 })).items;
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

/** Una página de los carros que hoy son de ese cliente, para su ficha (102). */
export function listCustomerVehiclesPage(
  customerId: string,
  params: { page?: number; pageSize?: number } = {},
): Promise<Page<VehicleWithOwner>> {
  return apiFetch<Page<VehicleWithOwner>>(
    `/vehicles${query({ customerId, page: params.page, pageSize: params.pageSize })}`,
  );
}

/** Los carros de un cliente para «¿Cuál trajo?» del alta: la página más grande (102). */
export async function listCustomerVehicles(customerId: string): Promise<VehicleWithOwner[]> {
  return (await listCustomerVehiclesPage(customerId, { pageSize: MAX_PAGE_SIZE })).items;
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
