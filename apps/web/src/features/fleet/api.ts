import type {
  CreateFleetVehicleInput,
  FleetVehicle,
  FleetVehiclesQuery,
  UpdateFleetVehicleInput,
} from '@elite/shared';

import { apiFetch } from '@/lib/api';

/** API de la flota de la rentadora (095). Sin `DELETE`: un carro se retira. */

function query(params: FleetVehiclesQuery): string {
  const search = new URLSearchParams();
  if (params.status !== undefined) search.set('status', params.status);
  if (params.q !== undefined && params.q !== '') search.set('q', params.q);
  const text = search.toString();

  return text === '' ? '' : `?${text}`;
}

export function listFleetVehicles(params: FleetVehiclesQuery = {}): Promise<FleetVehicle[]> {
  return apiFetch<FleetVehicle[]>(`/fleet/vehicles${query(params)}`);
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
