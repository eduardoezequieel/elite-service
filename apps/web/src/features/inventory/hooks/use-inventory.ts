'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  CreateInventoryAdjustmentInput,
  CreateInventoryCategoryInput,
  CreateInventoryDispatchInput,
  CreateInventoryEntryInput,
  CreateInventoryItemInput,
  InventoryCategory,
  InventoryEmployeeOption,
  InventoryItem,
  InventoryMovement,
  InventoryMovementResult,
  Page,
  UpdateInventoryCategoryInput,
  UpdateInventoryItemInput,
} from '@elite/shared';

import type { ApiError } from '@/lib/api';
import {
  createInventoryAdjustment,
  createInventoryCategory,
  createInventoryDispatch,
  createInventoryEntry,
  createInventoryItem,
  getInventoryItem,
  listDispatchEmployees,
  listInventoryCategories,
  listInventoryItems,
  listInventoryMovements,
  listItemMovements,
  updateInventoryCategory,
  updateInventoryItem,
  type InventoryItemsParams,
  type InventoryMovementsParams,
} from '../api';

/**
 * Toda la rama del inventario cuelga de esta clave: cualquier movimiento cambia
 * la existencia de la lista, la ficha, el kardex y el reporte, así que se
 * invalida entera.
 */
export const INVENTORY_QUERY_KEY = ['inventory'] as const;

export function useInventoryCategories(
  includeInactive = false,
  enabled = true,
): UseQueryResult<InventoryCategory[], ApiError> {
  return useQuery<InventoryCategory[], ApiError>({
    queryKey: [...INVENTORY_QUERY_KEY, 'categories', { includeInactive }],
    queryFn: () => listInventoryCategories(includeInactive),
    enabled,
  });
}

export function useInventoryItems(
  params: InventoryItemsParams,
  enabled = true,
): UseQueryResult<Page<InventoryItem>, ApiError> {
  return useQuery<Page<InventoryItem>, ApiError>({
    queryKey: [...INVENTORY_QUERY_KEY, 'items', params],
    queryFn: () => listInventoryItems(params),
    // Al cambiar de página o de búsqueda la tabla no parpadea a «Cargando…».
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useInventoryItem(
  id: string,
  enabled = true,
): UseQueryResult<InventoryItem, ApiError> {
  return useQuery<InventoryItem, ApiError>({
    queryKey: [...INVENTORY_QUERY_KEY, 'item', id],
    queryFn: () => getInventoryItem(id),
    enabled,
  });
}

export function useItemMovements(
  id: string,
  page: number,
  enabled = true,
): UseQueryResult<Page<InventoryMovement>, ApiError> {
  return useQuery<Page<InventoryMovement>, ApiError>({
    queryKey: [...INVENTORY_QUERY_KEY, 'item', id, 'movements', page],
    queryFn: () => listItemMovements(id, page),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useInventoryMovements(
  params: InventoryMovementsParams,
  enabled = true,
): UseQueryResult<Page<InventoryMovement>, ApiError> {
  return useQuery<Page<InventoryMovement>, ApiError>({
    queryKey: [...INVENTORY_QUERY_KEY, 'movements', params],
    queryFn: () => listInventoryMovements(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Empleados activos para el diálogo «Despachar» (RN-10). */
export function useDispatchEmployees(
  enabled = true,
): UseQueryResult<InventoryEmployeeOption[], ApiError> {
  return useQuery<InventoryEmployeeOption[], ApiError>({
    queryKey: [...INVENTORY_QUERY_KEY, 'employees'],
    queryFn: listDispatchEmployees,
    enabled,
  });
}

function useInventoryInvalidation() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEY });
  };
}

export function useCreateInventoryCategory() {
  const invalidate = useInventoryInvalidation();

  return useMutation<InventoryCategory, ApiError, CreateInventoryCategoryInput>({
    mutationFn: createInventoryCategory,
    onSuccess: invalidate,
  });
}

export function useUpdateInventoryCategory() {
  const invalidate = useInventoryInvalidation();

  return useMutation<
    InventoryCategory,
    ApiError,
    { id: string; input: UpdateInventoryCategoryInput }
  >({
    mutationFn: ({ id, input }) => updateInventoryCategory(id, input),
    onSuccess: invalidate,
  });
}

export function useCreateInventoryItem() {
  const invalidate = useInventoryInvalidation();

  return useMutation<InventoryItem, ApiError, CreateInventoryItemInput>({
    mutationFn: createInventoryItem,
    onSuccess: invalidate,
  });
}

export function useUpdateInventoryItem() {
  const invalidate = useInventoryInvalidation();

  return useMutation<InventoryItem, ApiError, { id: string; input: UpdateInventoryItemInput }>({
    mutationFn: ({ id, input }) => updateInventoryItem(id, input),
    onSuccess: invalidate,
  });
}

export function useCreateInventoryEntry() {
  const invalidate = useInventoryInvalidation();

  return useMutation<
    InventoryMovementResult,
    ApiError,
    { id: string; input: CreateInventoryEntryInput }
  >({
    mutationFn: ({ id, input }) => createInventoryEntry(id, input),
    onSuccess: invalidate,
  });
}

export function useCreateInventoryDispatch() {
  const invalidate = useInventoryInvalidation();

  return useMutation<
    InventoryMovementResult,
    ApiError,
    { id: string; input: CreateInventoryDispatchInput }
  >({
    mutationFn: ({ id, input }) => createInventoryDispatch(id, input),
    onSuccess: invalidate,
  });
}

export function useCreateInventoryAdjustment() {
  const invalidate = useInventoryInvalidation();

  return useMutation<
    InventoryMovementResult,
    ApiError,
    { id: string; input: CreateInventoryAdjustmentInput }
  >({
    mutationFn: ({ id, input }) => createInventoryAdjustment(id, input),
    onSuccess: invalidate,
  });
}
