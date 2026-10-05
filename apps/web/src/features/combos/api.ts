import type {
  ComboDetail,
  ComboStatus,
  CreateComboInput,
  Page,
  UpdateComboInput,
} from '@elite/shared';

import { listQuery } from '@/features/inventory/list-query';
import { apiFetch } from '@/lib/api';

/**
 * Combos del lavado (104): la pestaña Combos del catálogo. Los combos de hoy
 * del alta van por `/carwash/combos` y `/floor/combos`, en el API de cada vista.
 */

export interface CombosParams {
  /** Nombre o código. */
  search?: string;
  status?: ComboStatus;
  page?: number;
  pageSize?: number;
}

export function listCombos(params: CombosParams = {}): Promise<Page<ComboDetail>> {
  return apiFetch<Page<ComboDetail>>(
    `/combos${listQuery({
      search: params.search,
      status: params.status,
      page: params.page,
      pageSize: params.pageSize,
    })}`,
  );
}

export function createCombo(input: CreateComboInput): Promise<ComboDetail> {
  return apiFetch<ComboDetail>('/combos', { method: 'POST', body: JSON.stringify(input) });
}

/** `items`, `prices` y `weekdays` reemplazan; `{ isActive }` solo pausa o reactiva. */
export function updateCombo(id: string, input: UpdateComboInput): Promise<ComboDetail> {
  return apiFetch<ComboDetail>(`/combos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
