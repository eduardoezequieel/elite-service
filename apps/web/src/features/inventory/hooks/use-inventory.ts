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
  CreateInventoryConsumptionInput,
  CreateInventoryDispatchInput,
  CreateInventoryEntryInput,
  CreateInventoryItemInput,
  EmployeeConsumptionDetail,
  EmployeeConsumptionReport,
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
import {
  createInventoryAdjustment,
  createInventoryCategory,
  createInventoryConsumption,
  createInventoryDispatch,
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

/** El consumo del mes por trabajador (070). Cuelga de la rama del inventario. */
export function useEmployeeConsumptionReport(
  month: string,
  enabled = true,
): UseQueryResult<EmployeeConsumptionReport, ApiError> {
  return useQuery<EmployeeConsumptionReport, ApiError>({
    queryKey: [...INVENTORY_QUERY_KEY, 'consumptions', month],
    queryFn: () => getEmployeeConsumptionReport(month),
    // Al pasar de mes la tabla no parpadea a «Cargando…».
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useEmployeeConsumptionDetail(
  employeeId: string,
  month: string,
  enabled = true,
): UseQueryResult<EmployeeConsumptionDetail, ApiError> {
  return useQuery<EmployeeConsumptionDetail, ApiError>({
    queryKey: [...INVENTORY_QUERY_KEY, 'consumptions', month, employeeId],
    queryFn: () => getEmployeeConsumptionDetail(employeeId, month),
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

export function useCreateInventoryConsumption() {
  const invalidate = useInventoryInvalidation();

  return useMutation<
    InventoryMovementResult,
    ApiError,
    { id: string; input: CreateInventoryConsumptionInput }
  >({
    mutationFn: ({ id, input }) => createInventoryConsumption(id, input),
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
