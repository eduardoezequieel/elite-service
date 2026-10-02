'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  CashSession,
  CashSessionDetail,
  CloseCashInput,
  OpenCashInput,
  Page,
} from '@elite/shared';

import type { ApiError } from '@/lib/api';
import { ALWAYS_FRESH } from '@/lib/freshness';
import { LIST_PAGE_SIZE } from '@/lib/list-params';
import {
  closeCash,
  getCashSession,
  getCurrentCashSession,
  listCashSessions,
  openCash,
} from '../api';

export const CASH_QUERY_KEY = ['carwash', 'cash'] as const;

function useCashInvalidation() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: CASH_QUERY_KEY });
  };
}

export function useCurrentCashSession(
  enabled = true,
): UseQueryResult<CashSession | null, ApiError> {
  return useQuery<CashSession | null, ApiError>({
    queryKey: [...CASH_QUERY_KEY, 'current'],
    queryFn: getCurrentCashSession,
    enabled,
    ...ALWAYS_FRESH,
  });
}

/** Una página de los turnos (102). */
export function useCashSessions(
  page = 1,
  enabled = true,
): UseQueryResult<Page<CashSession>, ApiError> {
  return useQuery<Page<CashSession>, ApiError>({
    queryKey: [...CASH_QUERY_KEY, 'sessions', { page }],
    queryFn: () => listCashSessions({ page, pageSize: LIST_PAGE_SIZE }),
    placeholderData: keepPreviousData,
    enabled,
    ...ALWAYS_FRESH,
  });
}

/** El turno con una página de sus pagos (102); los totales son del turno entero. */
export function useCashSession(
  id: string,
  page = 1,
  enabled = true,
): UseQueryResult<CashSessionDetail, ApiError> {
  return useQuery<CashSessionDetail, ApiError>({
    queryKey: [...CASH_QUERY_KEY, 'sessions', id, { page }],
    queryFn: () => getCashSession(id, { page, pageSize: LIST_PAGE_SIZE }),
    placeholderData: keepPreviousData,
    enabled,
    ...ALWAYS_FRESH,
  });
}

export function useOpenCash() {
  const invalidate = useCashInvalidation();

  return useMutation<CashSession, ApiError, OpenCashInput>({
    mutationFn: openCash,
    onSuccess: invalidate,
  });
}

export function useCloseCash() {
  const invalidate = useCashInvalidation();

  return useMutation<CashSession, ApiError, CloseCashInput>({
    mutationFn: closeCash,
    onSuccess: invalidate,
  });
}
