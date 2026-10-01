import type {
  CreateRenterInput,
  ImportRentersInput,
  Renter,
  RenterImportResult,
  RentersQuery,
  UpdateRenterInput,
} from '@elite/shared';

import { apiFetch } from '@/lib/api';

/** API de los clientes de renta (095). Sin `DELETE`: se desactivan o se bloquean. */

function query(params: RentersQuery): string {
  const search = new URLSearchParams();
  if (params.q !== undefined && params.q !== '') search.set('q', params.q);
  if (params.blocked !== undefined) search.set('blocked', String(params.blocked));
  if (params.active !== undefined) search.set('active', String(params.active));
  const text = search.toString();

  return text === '' ? '' : `?${text}`;
}

export function listRenters(params: RentersQuery = {}): Promise<Renter[]> {
  return apiFetch<Renter[]>(`/renters${query(params)}`);
}

export function getRenter(id: string): Promise<Renter> {
  return apiFetch<Renter>(`/renters/${id}`);
}

export function createRenter(input: CreateRenterInput): Promise<Renter> {
  return apiFetch<Renter>('/renters', { method: 'POST', body: JSON.stringify(input) });
}

export function updateRenter(id: string, input: UpdateRenterInput): Promise<Renter> {
  return apiFetch<Renter>(`/renters/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function importRenters(input: ImportRentersInput): Promise<RenterImportResult> {
  return apiFetch<RenterImportResult>('/renters/import', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
