'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateServiceCategoryInput,
  CreateServiceInput,
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
} from '../api';

export const CATALOG_QUERY_KEY = ['catalog'] as const;

export function useCatalogServices(enabled = true) {
  return useQuery<ServiceDetail[], ApiError>({
    queryKey: [...CATALOG_QUERY_KEY, 'services'],
    queryFn: listServices,
    enabled,
  });
}

export function useCatalogCategories(enabled = true) {
  return useQuery({
    queryKey: [...CATALOG_QUERY_KEY, 'categories'],
    queryFn: listCategories,
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
