'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type { CashSession, CashSessionDetail, CloseCashInput, OpenCashInput } from '@elite/shared';

import type { ApiError } from '@/lib/api';
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
  });
}

export function useCashSessions(enabled = true): UseQueryResult<CashSession[], ApiError> {
  return useQuery<CashSession[], ApiError>({
    queryKey: [...CASH_QUERY_KEY, 'sessions'],
    queryFn: listCashSessions,
    enabled,
  });
}

export function useCashSession(
  id: string,
  enabled = true,
): UseQueryResult<CashSessionDetail, ApiError> {
  return useQuery<CashSessionDetail, ApiError>({
    queryKey: [...CASH_QUERY_KEY, 'sessions', id],
    queryFn: () => getCashSession(id),
    enabled,
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
