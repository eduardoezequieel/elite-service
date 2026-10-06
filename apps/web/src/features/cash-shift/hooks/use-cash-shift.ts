'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type { CashSession, CloseCashInput, OpenCashInput, Page } from '@elite/shared';

import type { ApiError } from '@/lib/api';
import { ALWAYS_FRESH } from '@/lib/freshness';
import { LIST_PAGE_SIZE } from '@/lib/list-params';

import type { CashShiftAdapter, CashShiftPayment } from '../adapter';
import {
  closeCashShift,
  getCashShift,
  getCurrentCashShift,
  listCashShifts,
  openCashShift,
} from '../api';

type ShiftTarget = Pick<CashShiftAdapter<CashShiftPayment>, 'basePath' | 'queryKey'>;

function useShiftInvalidation(queryKey: readonly string[]) {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey });
  };
}

export function useCurrentCashShift<TSession = CashSession>(
  adapter: ShiftTarget,
  enabled = true,
): UseQueryResult<TSession | null, ApiError> {
  return useQuery<TSession | null, ApiError>({
    queryKey: [...adapter.queryKey, 'current'],
    queryFn: () => getCurrentCashShift<TSession>(adapter.basePath),
    enabled,
    ...ALWAYS_FRESH,
  });
}

export function useCashShiftList<TSession = CashSession>(
  adapter: ShiftTarget,
  page = 1,
  enabled = true,
): UseQueryResult<Page<TSession>, ApiError> {
  return useQuery<Page<TSession>, ApiError>({
    queryKey: [...adapter.queryKey, 'sessions', { page }],
    queryFn: () => listCashShifts<TSession>(adapter.basePath, { page, pageSize: LIST_PAGE_SIZE }),
    placeholderData: keepPreviousData,
    enabled,
    ...ALWAYS_FRESH,
  });
}

export function useCashShiftSession<TDetail>(
  adapter: ShiftTarget,
  id: string,
  page = 1,
  enabled = true,
): UseQueryResult<TDetail, ApiError> {
  return useQuery<TDetail, ApiError>({
    queryKey: [...adapter.queryKey, 'sessions', id, { page }],
    queryFn: () => getCashShift<TDetail>(adapter.basePath, id, { page, pageSize: LIST_PAGE_SIZE }),
    placeholderData: keepPreviousData,
    enabled,
    ...ALWAYS_FRESH,
  });
}

export function useOpenCashShift<TSession = CashSession>(adapter: ShiftTarget) {
  const invalidate = useShiftInvalidation(adapter.queryKey);

  return useMutation<TSession, ApiError, OpenCashInput>({
    mutationFn: (input) => openCashShift<TSession>(adapter.basePath, input),
    onSuccess: invalidate,
  });
}

export function useCloseCashShift<TSession = CashSession>(adapter: ShiftTarget) {
  const invalidate = useShiftInvalidation(adapter.queryKey);

  return useMutation<TSession, ApiError, CloseCashInput>({
    mutationFn: (input) => closeCashShift<TSession>(adapter.basePath, input),
    onSuccess: invalidate,
  });
}
