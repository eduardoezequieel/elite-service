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
  CreateInventoryDeliveryInput,
  CreateInventoryEntriesInput,
  CreateInventoryEntryInput,
  CreateInventoryItemInput,
  EmployeeConsumptionDetail,
  EmployeeConsumptionReport,
  InventoryBatchResult,
  InventoryCategory,
  InventoryEmployeeOption,
  InventoryItem,
  InventoryMovement,
  InventoryMovementResult,
  Page,
  ReverseInventoryConsumptionInput,
  UpdateInventoryCategoryInput,
  UpdateInventoryItemInput,
} from '@elite/shared';

import type { ApiError } from '@/lib/api';
import type { CivilRange } from '@/lib/civil-date';
import {
  createInventoryAdjustment,
  createInventoryCategory,
  createInventoryDelivery,
  createInventoryEntries,
  createInventoryEntry,
  createInventoryItem,
  getEmployeeConsumptionDetail,
  getEmployeeConsumptionReport,
  getInventoryItem,
  listDispatchEmployees,
  listInventoryCategories,
  listInventoryItems,
  listInventoryMovements,
  listItemMovements,
  reverseInventoryConsumption,
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

/** Las categorías de un tipo (072): la clave lleva el tipo, así no se pisan entre sí. */
export function useInventoryCategories(
  params: InventoryCategoriesParams = {},
  enabled = true,
): UseQueryResult<InventoryCategory[], ApiError> {
  const kind = params.kind;
  const includeInactive = params.includeInactive ?? false;

  return useQuery<InventoryCategory[], ApiError>({
    queryKey: [...INVENTORY_QUERY_KEY, 'categories', { kind: kind ?? null, includeInactive }],
    queryFn: () => listInventoryCategories({ kind, includeInactive }),
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
 * Empleados activos para los diálogos «Despachar» (RN-10) y «Consumo de
 * empleado» (070): la misma lista, con el mismo `inventory.move`.
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

/** Lo que tomó cada trabajador en el rango (070, 091). Cuelga de la rama del inventario. */
export function useEmployeeConsumptionReport(
  range: CivilRange,
  enabled = true,
): UseQueryResult<EmployeeConsumptionReport, ApiError> {
  return useQuery<EmployeeConsumptionReport, ApiError>({
    queryKey: [...INVENTORY_QUERY_KEY, 'consumptions', range.from, range.to],
    queryFn: () => getEmployeeConsumptionReport(range),
    // Al cambiar de fechas la tabla no parpadea a «Cargando…».
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useEmployeeConsumptionDetail(
  employeeId: string,
  range: CivilRange,
  enabled = true,
): UseQueryResult<EmployeeConsumptionDetail, ApiError> {
  return useQuery<EmployeeConsumptionDetail, ApiError>({
    queryKey: [...INVENTORY_QUERY_KEY, 'consumptions', range.from, range.to, employeeId],
    queryFn: () => getEmployeeConsumptionDetail(employeeId, range),
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

/**
 * Anular un consumo. También invalida si falla: un `CONSUMPTION_ALREADY_REVERSED`
 * quiere decir que alguien lo anuló antes, y la tabla tiene que mostrarlo.
 */
export function useReverseInventoryConsumption() {
  const invalidate = useInventoryInvalidation();

  return useMutation<
    InventoryMovementResult,
    ApiError,
    { movementId: string; input: ReverseInventoryConsumptionInput }
  >({
    mutationFn: ({ movementId, input }) => reverseInventoryConsumption(movementId, input),
    onSettled: invalidate,
  });
}
