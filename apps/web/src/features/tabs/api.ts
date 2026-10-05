import type {
  AddTabLinesInput,
  PayTabInput,
  TabDetail,
  TabHolderOptions,
  TabList,
  TabsQuery,
  VoidTabLineInput,
} from '@elite/shared';

import { apiFetch } from '@/lib/api';

/**
 * API de las cuentas abiertas (105), desde la oficina. Anotar, quitar y cobrar
 * piden `carwash.charge`; leer, `carwash.read`. El selector de titular
 * (`holders`) también pide `carwash.charge`: solo lo usa quien anota.
 */

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams(
    Object.entries(params)
      .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
      .map(([key, value]) => [key, String(value)]),
  ).toString();

  return search === '' ? '' : `?${search}`;
}

export function listTabs(params: Partial<TabsQuery> = {}): Promise<TabList> {
  return apiFetch<TabList>(`/tabs${query(params)}`);
}

export function listTabHolders(search: string): Promise<TabHolderOptions> {
  return apiFetch<TabHolderOptions>(
    `/tabs/holders${query({ search: search === '' ? undefined : search })}`,
  );
}

export function getTab(id: string): Promise<TabDetail> {
  return apiFetch<TabDetail>(`/tabs/${id}`);
}

export function addTabLines(input: AddTabLinesInput): Promise<TabDetail> {
  return apiFetch<TabDetail>('/tabs/lines', { method: 'POST', body: JSON.stringify(input) });
}

export function voidTabLine(
  tabId: string,
  lineId: string,
  input: VoidTabLineInput,
): Promise<TabDetail> {
  return apiFetch<TabDetail>(`/tabs/${tabId}/lines/${lineId}/void`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function payTab(tabId: string, input: PayTabInput): Promise<TabDetail> {
  return apiFetch<TabDetail>(`/tabs/${tabId}/payments`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
