import type {
  CreateServiceCategoryInput,
  CreateServiceInput,
  ServiceCategorySummary,
  ServiceDetail,
  UpdateServiceCategoryInput,
  UpdateServiceInput,
  VehicleBodyType,
} from '@elite/shared';

import { apiFetch } from '@/lib/api';

/** Catálogo de lavado: categorías, servicios y su matriz de precios. */

export function listCategories(): Promise<ServiceCategorySummary[]> {
  return apiFetch<ServiceCategorySummary[]>('/service-categories');
}

export function createCategory(
  input: CreateServiceCategoryInput,
): Promise<ServiceCategorySummary> {
  return apiFetch<ServiceCategorySummary>('/service-categories', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateCategory(
  id: string,
  input: UpdateServiceCategoryInput,
): Promise<ServiceCategorySummary> {
  return apiFetch<ServiceCategorySummary>(`/service-categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function listServices(): Promise<ServiceDetail[]> {
  return apiFetch<ServiceDetail[]>('/services');
}

export function createService(input: CreateServiceInput): Promise<ServiceDetail> {
  return apiFetch<ServiceDetail>('/services', { method: 'POST', body: JSON.stringify(input) });
}

/** `prices` reemplaza la matriz completa; omitirlo la deja intacta (RN-2). */
export function updateService(id: string, input: UpdateServiceInput): Promise<ServiceDetail> {
  return apiFetch<ServiceDetail>(`/services/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function listBodyTypes(): Promise<VehicleBodyType[]> {
  return apiFetch<VehicleBodyType[]>('/vehicle-body-types');
}
