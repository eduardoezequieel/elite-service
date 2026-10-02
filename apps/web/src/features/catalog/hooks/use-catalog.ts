'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { MAX_PAGE_SIZE } from '@elite/shared';
import type {
  CreateServiceCategoryInput,
  CreateServiceInput,
  Page,
  ServiceCategorySummary,
  ServiceDetail,
  UpdateServiceCategoryInput,
  UpdateServiceInput,
} from '@elite/shared';

import type { ApiError } from '@/lib/api';
import {
  createCategory,
  createService,
  listBodyTypes,
  listCategories,
  listServices,
  updateCategory,
  updateService,
  type CategoriesParams,
  type ServicesParams,
} from '../api';

export const CATALOG_QUERY_KEY = ['catalog'] as const;

/** Una página de Catálogo → Servicios (spec 102). */
export function useCatalogServices(
  params: ServicesParams,
  enabled = true,
): UseQueryResult<Page<ServiceDetail>, ApiError> {
  return useQuery<Page<ServiceDetail>, ApiError>({
    queryKey: [...CATALOG_QUERY_KEY, 'services', params],
    queryFn: () => listServices(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/**
 * Las categorías como opciones de un selector (el servicio, el filtro): la
 * primera página con el tope del API, ya como lista.
 */
export function useCatalogCategories(
  enabled = true,
): UseQueryResult<ServiceCategorySummary[], ApiError> {
  return useQuery<Page<ServiceCategorySummary>, ApiError, ServiceCategorySummary[]>({
    queryKey: [...CATALOG_QUERY_KEY, 'categories', 'options'],
    queryFn: () => listCategories({ pageSize: MAX_PAGE_SIZE }),
    select: (page) => page.items,
    enabled,
  });
}

/** Una página de la pantalla Categorías (spec 102). */
export function useCatalogCategoriesPage(
  params: CategoriesParams,
  enabled = true,
): UseQueryResult<Page<ServiceCategorySummary>, ApiError> {
  return useQuery<Page<ServiceCategorySummary>, ApiError>({
    queryKey: [...CATALOG_QUERY_KEY, 'categories', 'page', params],
    queryFn: () => listCategories(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useCatalogBodyTypes(enabled = true) {
  return useQuery({
    queryKey: [...CATALOG_QUERY_KEY, 'body-types'],
    queryFn: listBodyTypes,
    enabled,
  });
}

/**
 * Tocar el catálogo invalida también los tickets: la pantalla de alta muestra
 * precios, y quedarse con la copia vieja ofrecería un precio que ya no existe.
 */
function useCatalogInvalidation() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ['carwash'] });
  };
}

export function useUpdateCategory() {
  const invalidate = useCatalogInvalidation();

  return useMutation<
    ServiceCategorySummary,
    ApiError,
    { id: string; input: UpdateServiceCategoryInput }
  >({
    mutationFn: ({ id, input }) => updateCategory(id, input),
    onSuccess: invalidate,
  });
}

export function useCreateCategory() {
  const invalidate = useCatalogInvalidation();

  return useMutation<ServiceCategorySummary, ApiError, CreateServiceCategoryInput>({
    mutationFn: createCategory,
    onSuccess: invalidate,
  });
}

export function useCreateService() {
  const invalidate = useCatalogInvalidation();

  return useMutation<ServiceDetail, ApiError, CreateServiceInput>({
    mutationFn: createService,
    onSuccess: invalidate,
  });
}

export function useUpdateService() {
  const invalidate = useCatalogInvalidation();

  return useMutation<ServiceDetail, ApiError, { id: string; input: UpdateServiceInput }>({
    mutationFn: ({ id, input }) => updateService(id, input),
    onSuccess: invalidate,
  });
}
