import type {
  CreateFleetVehicleInput,
  FleetVehicle,
  FleetVehiclesQuery,
  Page,
  UpdateFleetVehicleInput,
} from '@elite/shared';

import { apiFetch } from '@/lib/api';

/** API de la flota de la rentadora (095). Sin `DELETE`: un carro se retira. */

/** Lo que pide una pantalla: el API pone la página 1 y su tamaño si no vienen. */
export type FleetVehiclesParams = Partial<FleetVehiclesQuery>;

function query(params: FleetVehiclesParams): string {
  const search = new URLSearchParams();
  if (params.status !== undefined) search.set('status', params.status);
  if (params.q !== undefined && params.q !== '') search.set('q', params.q);
  if (params.page !== undefined) search.set('page', String(params.page));
  if (params.pageSize !== undefined) search.set('pageSize', String(params.pageSize));
  const text = search.toString();

  return text === '' ? '' : `?${text}`;
}

/** Una página de la flota (101). */
export function listFleetVehicles(params: FleetVehiclesParams = {}): Promise<Page<FleetVehicle>> {
  return apiFetch<Page<FleetVehicle>>(`/fleet/vehicles${query(params)}`);
}

export function getFleetVehicle(id: string): Promise<FleetVehicle> {
  return apiFetch<FleetVehicle>(`/fleet/vehicles/${id}`);
}

export function createFleetVehicle(input: CreateFleetVehicleInput): Promise<FleetVehicle> {
  return apiFetch<FleetVehicle>('/fleet/vehicles', { method: 'POST', body: JSON.stringify(input) });
}

export function updateFleetVehicle(
  id: string,
  input: UpdateFleetVehicleInput,
): Promise<FleetVehicle> {
  return apiFetch<FleetVehicle>(`/fleet/vehicles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
