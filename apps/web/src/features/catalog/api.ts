import type {
  CreateServiceCategoryInput,
  CreateServiceInput,
  Page,
  ServiceCategorySummary,
  ServiceDetail,
  UpdateServiceCategoryInput,
  UpdateServiceInput,
  VehicleBodyType,
} from '@elite/shared';

import { listQuery } from '@/features/inventory/list-query';
import { apiFetch } from '@/lib/api';

/**
 * Catálogo de lavado: categorías, servicios y su matriz de precios. Las listas
 * vienen de a una página (spec 102).
 */

export interface CategoriesParams {
  /** `true` solo activas, `false` solo inactivas, sin él todas. */
  active?: boolean;
  page?: number;
  pageSize?: number;
}

export function listCategories(
  params: CategoriesParams = {},
): Promise<Page<ServiceCategorySummary>> {
  return apiFetch<Page<ServiceCategorySummary>>(
    `/service-categories${listQuery({
      active: params.active,
      page: params.page,
      pageSize: params.pageSize,
    })}`,
  );
}

export function createCategory(input: CreateServiceCategoryInput): Promise<ServiceCategorySummary> {
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

export interface ServicesParams {
  /** Nombre, código o nombre de la categoría. */
  search?: string;
  categoryId?: string;
  /** `true` solo activos, `false` solo inactivos, sin él todos. */
  active?: boolean;
  page?: number;
  pageSize?: number;
}

export function listServices(params: ServicesParams = {}): Promise<Page<ServiceDetail>> {
  return apiFetch<Page<ServiceDetail>>(
    `/services${listQuery({
      search: params.search,
      categoryId: params.categoryId,
      active: params.active,
      page: params.page,
      pageSize: params.pageSize,
    })}`,
  );
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
