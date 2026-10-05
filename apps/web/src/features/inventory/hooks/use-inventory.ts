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
  CreateInventoryAdjustmentInput,
  CreateInventoryCategoryInput,
  CreateInventoryDeliveryInput,
  CreateInventoryEntriesInput,
  CreateInventoryEntryInput,
  CreateInventoryItemInput,
  InventoryBatchResult,
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
  createInventoryDelivery,
  createInventoryEntries,
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
  type InventoryCategoriesParams,
  type InventoryItemsParams,
  type InventoryMovementsParams,
} from '../api';

/**
 * Toda la rama del inventario cuelga de esta clave: cualquier movimiento cambia
 * la existencia de la lista, la ficha, el kardex y el reporte, así que se
 * invalida entera.
 */
export const INVENTORY_QUERY_KEY = ['inventory'] as const;

/**
 * Las categorías de un tipo (072) como opciones de un selector: la primera
 * página con el tope del API, ya como lista. La clave lleva el tipo, así no se
 * pisan entre sí.
 */
export function useInventoryCategories(
  params: Pick<InventoryCategoriesParams, 'kind' | 'includeInactive'> = {},
  enabled = true,
): UseQueryResult<InventoryCategory[], ApiError> {
  const kind = params.kind;
  const includeInactive = params.includeInactive ?? false;

  return useQuery<Page<InventoryCategory>, ApiError, InventoryCategory[]>({
    queryKey: [...INVENTORY_QUERY_KEY, 'categories', { kind: kind ?? null, includeInactive }],
    queryFn: () => listInventoryCategories({ kind, includeInactive, pageSize: MAX_PAGE_SIZE }),
    select: (page) => page.items,
    enabled,
  });
}

/** Una página de la pantalla de categorías del inventario (spec 102). */
export function useInventoryCategoriesPage(
  params: InventoryCategoriesParams,
  enabled = true,
): UseQueryResult<Page<InventoryCategory>, ApiError> {
  return useQuery<Page<InventoryCategory>, ApiError>({
    queryKey: [...INVENTORY_QUERY_KEY, 'categories', 'page', params],
    queryFn: () => listInventoryCategories(params),
    placeholderData: keepPreviousData,
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

/**
 * Empleados activos para los diálogos «Despachar» y «Entregar a empleado»
 * (RN-10), con el mismo `inventory.move`.
 */
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

/** Una entrada de varios artículos (091). */
export function useCreateInventoryEntries() {
  const invalidate = useInventoryInvalidation();

  return useMutation<InventoryBatchResult, ApiError, CreateInventoryEntriesInput>({
    mutationFn: createInventoryEntries,
    onSuccess: invalidate,
  });
}

/** Lo que se lleva un trabajador: consumo o despacho según el artículo (091). */
export function useCreateInventoryDelivery() {
  const invalidate = useInventoryInvalidation();

  return useMutation<InventoryBatchResult, ApiError, CreateInventoryDeliveryInput>({
    mutationFn: createInventoryDelivery,
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
