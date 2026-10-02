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
  InventoryItemKind,
  InventoryMovement,
  InventoryMovementResult,
  Page,
  ReverseInventoryConsumptionInput,
  UpdateInventoryCategoryInput,
  UpdateInventoryItemInput,
} from '@elite/shared';

import { apiFetch } from '@/lib/api';
import type { CivilRange } from '@/lib/civil-date';
import { listQuery } from './list-query';

/** Inventario desde la oficina (spec 065). Todo bajo `/api/inventory`, sesión de usuario. */

type QueryValue = string | number | boolean | undefined;

function query(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams(
    Object.entries(params)
      .filter((entry): entry is [string, string | number | boolean] => {
        const value = entry[1];
        return value !== undefined && value !== '' && value !== false;
      })
      .map(([key, value]) => [key, String(value)]),
  ).toString();

  return search === '' ? '' : `?${search}`;
}

// --- categorías ---

export interface InventoryCategoriesParams {
  /** Solo las de productos o las de insumos (072). Sin él, todas. */
  kind?: InventoryItemKind;
  includeInactive?: boolean;
  /** Manda sobre `includeInactive`: `true` solo activas, `false` solo inactivas (102). */
  active?: boolean;
  page?: number;
  pageSize?: number;
}

/** De a una página (spec 102). */
export function listInventoryCategories(
  params: InventoryCategoriesParams = {},
): Promise<Page<InventoryCategory>> {
  return apiFetch<Page<InventoryCategory>>(
    `/inventory/categories${listQuery({
      kind: params.kind,
      includeInactive: params.includeInactive || undefined,
      active: params.active,
      page: params.page,
      pageSize: params.pageSize,
    })}`,
  );
}

export function createInventoryCategory(
  input: CreateInventoryCategoryInput,
): Promise<InventoryCategory> {
  return apiFetch<InventoryCategory>('/inventory/categories', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateInventoryCategory(
  id: string,
  input: UpdateInventoryCategoryInput,
): Promise<InventoryCategory> {
  return apiFetch<InventoryCategory>(`/inventory/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

// --- artículos ---

export interface InventoryItemsParams {
  kind?: InventoryItemKind;
  search?: string;
  categoryId?: string;
  lowStock?: boolean;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
}

export function listInventoryItems(
  params: InventoryItemsParams = {},
): Promise<Page<InventoryItem>> {
  return apiFetch<Page<InventoryItem>>(
    `/inventory/items${query({
      kind: params.kind,
      search: params.search,
      categoryId: params.categoryId,
      lowStock: params.lowStock,
      includeInactive: params.includeInactive,
      page: params.page,
      pageSize: params.pageSize,
    })}`,
  );
}

export function getInventoryItem(id: string): Promise<InventoryItem> {
  return apiFetch<InventoryItem>(`/inventory/items/${id}`);
}

export function createInventoryItem(input: CreateInventoryItemInput): Promise<InventoryItem> {
  return apiFetch<InventoryItem>('/inventory/items', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** `kind` no se acepta: se fija al crear (RN-1). */
export function updateInventoryItem(
  id: string,
  input: UpdateInventoryItemInput,
): Promise<InventoryItem> {
  return apiFetch<InventoryItem>(`/inventory/items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

// --- movimientos ---

/** El kardex de un artículo, más nuevo primero. */
export function listItemMovements(id: string, page = 1): Promise<Page<InventoryMovement>> {
  return apiFetch<Page<InventoryMovement>>(`/inventory/items/${id}/movements${query({ page })}`);
}

export function createInventoryEntry(
  id: string,
  input: CreateInventoryEntryInput,
): Promise<InventoryMovementResult> {
  return apiFetch<InventoryMovementResult>(`/inventory/items/${id}/entries`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** A quién se puede despachar: empleados activos. Pide `inventory.move`, no `employees.read`. */
export function listDispatchEmployees(): Promise<InventoryEmployeeOption[]> {
  return apiFetch<InventoryEmployeeOption[]>('/inventory/employees');
}

/** Una entrada de varios artículos con una sola referencia: todo o nada (091 RN-2). */
export function createInventoryEntries(
  input: CreateInventoryEntriesInput,
): Promise<InventoryBatchResult> {
  return apiFetch<InventoryBatchResult>('/inventory/entries', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Lo que se lleva un trabajador (091): el API anota cada producto como consumo
 * y despacha cada insumo (RN-1). Todo o nada.
 */
export function createInventoryDelivery(
  input: CreateInventoryDeliveryInput,
): Promise<InventoryBatchResult> {
  return apiFetch<InventoryBatchResult>('/inventory/deliveries', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function createInventoryAdjustment(
  id: string,
  input: CreateInventoryAdjustmentInput,
): Promise<InventoryMovementResult> {
  return apiFetch<InventoryMovementResult>(`/inventory/items/${id}/adjustments`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface InventoryMovementsParams {
  /** Uno o varios tipos separados por coma (091). */
  type?: string;
  itemId?: string;
  employeeId?: string;
  from?: string;
  to?: string;
  page?: number;
}

/** El reporte plano: «quién despachó qué y a quién». */
export function listInventoryMovements(
  params: InventoryMovementsParams = {},
): Promise<Page<InventoryMovement>> {
  return apiFetch<Page<InventoryMovement>>(
    `/inventory/movements${query({
      type: params.type,
      itemId: params.itemId,
      employeeId: params.employeeId,
      from: params.from,
      to: params.to,
      page: params.page,
    })}`,
  );
}

// --- consumo de empleados (spec 070) ---

/** Anular un consumo mal anotado, con motivo (RN-6). */
export function reverseInventoryConsumption(
  movementId: string,
  input: ReverseInventoryConsumptionInput,
): Promise<InventoryMovementResult> {
  return apiFetch<InventoryMovementResult>(`/inventory/consumptions/${movementId}/reverse`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** La página de una lista de consumos (102); los totales son del rango entero. */
export interface ConsumptionPageParams {
  page?: number;
  pageSize?: number;
}

/** Lo que tomó cada trabajador en el rango, civil e inclusive (091 RN-4). */
export function getEmployeeConsumptionReport(
  range: CivilRange,
  paging: ConsumptionPageParams = {},
): Promise<EmployeeConsumptionReport> {
  return apiFetch<EmployeeConsumptionReport>(
    `/inventory/consumptions${query({
      from: range.from,
      to: range.to,
      page: paging.page,
      pageSize: paging.pageSize,
    })}`,
  );
}

/** Los consumos de un trabajador en el rango, anulados incluidos. */
export function getEmployeeConsumptionDetail(
  employeeId: string,
  range: CivilRange,
  paging: ConsumptionPageParams = {},
): Promise<EmployeeConsumptionDetail> {
  return apiFetch<EmployeeConsumptionDetail>(
    `/inventory/consumptions/${employeeId}${query({
      from: range.from,
      to: range.to,
      page: paging.page,
      pageSize: paging.pageSize,
    })}`,
  );
}
