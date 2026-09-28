import {
  INVENTORY_MOVEMENT_TYPES,
  type InventoryItemKind,
  type InventoryMovementType,
} from '@elite/shared';

import { isCivil, presetRange, type CivilRange } from '@/lib/civil-date';
import { ALL_FILTER, isAll } from '@/lib/list-filters';
import { pageParam, singleParam, type SearchValue } from '@/lib/list-params';

/**
 * El estado de las listas del inventario vive en la URL (spec 065 + 056): la
 * ficha que se abre desde una fila vuelve a la lista con la misma pestaña, la
 * misma búsqueda y los mismos filtros puestos. Acá se lee y se arma la query;
 * se escribe con `replaceQuery` de `lib/list-params` (076).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// --- /inventory ---

export interface InventoryListState {
  kind: InventoryItemKind;
  search: string;
  lowStock: boolean;
  includeInactive: boolean;
  page: number;
}

export const DEFAULT_INVENTORY_LIST: InventoryListState = {
  kind: 'PRODUCT',
  search: '',
  lowStock: false,
  includeInactive: false,
  page: 1,
};

export function inventoryListFrom(params: Record<string, SearchValue>): InventoryListState {
  const kind = singleParam(params.kind);
  const search = singleParam(params.q);

  return {
    kind: kind === 'SUPPLY' ? 'SUPPLY' : 'PRODUCT',
    search: search?.slice(0, 120) ?? '',
    lowStock: singleParam(params.low) === '1',
    includeInactive: singleParam(params.inactive) === '1',
    page: pageParam(params.page),
  };
}

/** Solo lo que no es el valor por defecto: una lista recién abierta queda con la URL limpia. */
export function inventoryListQuery(state: InventoryListState): string {
  const params = new URLSearchParams();

  if (state.kind !== DEFAULT_INVENTORY_LIST.kind) params.set('kind', state.kind);
  if (state.search.trim() !== '') params.set('q', state.search.trim());
  if (state.lowStock) params.set('low', '1');
  if (state.includeInactive) params.set('inactive', '1');
  if (state.page > 1) params.set('page', String(state.page));

  return params.toString();
}

// --- /inventory/movements ---

export interface MovementsFilterState {
  /** `ALL_FILTER` o un `InventoryMovementType`. */
  type: string;
  /** `ALL_FILTER` o el id de un artículo. */
  itemId: string;
  /** `ALL_FILTER` o el id del empleado que recibió. */
  employeeId: string;
  range: CivilRange;
  page: number;
}

/** Los parámetros del rango se llaman `start`/`end`: `from` ya es el origen del regreso (056). */
export const MOVEMENTS_START_PARAM = 'start';
export const MOVEMENTS_END_PARAM = 'end';

function isMovementType(value: string): value is InventoryMovementType {
  return (INVENTORY_MOVEMENT_TYPES as readonly string[]).includes(value);
}

export function movementsFilterFrom(
  params: Record<string, SearchValue>,
  today?: string,
): MovementsFilterState {
  const type = singleParam(params.type);
  const itemId = singleParam(params.item);
  const employeeId = singleParam(params.employee);
  const start = singleParam(params[MOVEMENTS_START_PARAM]);
  const end = singleParam(params[MOVEMENTS_END_PARAM]);
  const range =
    start !== null && end !== null && isCivil(start) && isCivil(end) && start <= end
      ? { from: start, to: end }
      : presetRange('month', today);

  return {
    type: type !== null && isMovementType(type) ? type : ALL_FILTER,
    itemId: itemId !== null && UUID_RE.test(itemId) ? itemId : ALL_FILTER,
    employeeId: employeeId !== null && UUID_RE.test(employeeId) ? employeeId : ALL_FILTER,
    range,
    page: pageParam(params.page),
  };
}

export function movementsFilterQuery(state: MovementsFilterState): string {
  const params = new URLSearchParams();

  if (!isAll(state.type)) params.set('type', state.type);
  if (!isAll(state.itemId)) params.set('item', state.itemId);
  if (!isAll(state.employeeId)) params.set('employee', state.employeeId);
  params.set(MOVEMENTS_START_PARAM, state.range.from);
  params.set(MOVEMENTS_END_PARAM, state.range.to);
  if (state.page > 1) params.set('page', String(state.page));

  return params.toString();
}

/** Lo que va al API: `GET /api/inventory/movements`. */
export interface MovementsApiQuery {
  type?: InventoryMovementType;
  itemId?: string;
  employeeId?: string;
  from: string;
  to: string;
  page: number;
}

export function movementsApiQuery(state: MovementsFilterState): MovementsApiQuery {
  return {
    ...(!isAll(state.type) && isMovementType(state.type) ? { type: state.type } : {}),
    ...(isAll(state.itemId) ? {} : { itemId: state.itemId }),
    ...(isAll(state.employeeId) ? {} : { employeeId: state.employeeId }),
    from: state.range.from,
    to: state.range.to,
    page: state.page,
  };
}
