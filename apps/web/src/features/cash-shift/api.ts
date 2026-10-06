import type { CloseCashInput, OpenCashInput, Page, PageQuery } from '@elite/shared';

import { apiFetch } from '@/lib/api';

function pageSearch(page: PageQuery): string {
  const search = new URLSearchParams({
    page: String(page.page),
    pageSize: String(page.pageSize),
  });

  return `?${search.toString()}`;
}

export function getCurrentCashShift<TSession>(basePath: string): Promise<TSession | null> {
  return apiFetch<TSession | null>(`${basePath}/current`);
}

export function listCashShifts<TSession>(
  basePath: string,
  page: PageQuery,
): Promise<Page<TSession>> {
  return apiFetch<Page<TSession>>(`${basePath}/sessions${pageSearch(page)}`);
}

export function getCashShift<TDetail>(
  basePath: string,
  id: string,
  page: PageQuery,
): Promise<TDetail> {
  return apiFetch<TDetail>(`${basePath}/sessions/${id}${pageSearch(page)}`);
}

export function openCashShift<TSession>(basePath: string, input: OpenCashInput): Promise<TSession> {
  return apiFetch<TSession>(`${basePath}/open`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function closeCashShift<TSession>(
  basePath: string,
  input: CloseCashInput,
): Promise<TSession> {
  return apiFetch<TSession>(`${basePath}/close`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
