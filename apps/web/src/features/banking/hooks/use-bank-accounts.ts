'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { MAX_PAGE_SIZE } from '@elite/shared';
import type {
  BankAccount,
  CreateBankAccountInput,
  Page,
  UpdateBankAccountInput,
} from '@elite/shared';

import type { ApiError } from '@/lib/api';
import {
  createBankAccount,
  listBankAccounts,
  updateBankAccount,
  type BankAccountsParams,
} from '../api';

/** Prefijo de todo lo de cuentas: la lista de ajustes y la de activas del cobro. */
export const BANK_ACCOUNTS_QUERY_KEY = ['banking', 'accounts'] as const;

/** Una página de la lista de ajustes (`banking.manage`, spec 102). */
export function useBankAccounts(
  params: BankAccountsParams,
  enabled = true,
): UseQueryResult<Page<BankAccount>, ApiError> {
  return useQuery<Page<BankAccount>, ApiError>({
    queryKey: [...BANK_ACCOUNTS_QUERY_KEY, 'page', params],
    queryFn: () => listBankAccounts(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/**
 * Las cuentas que se pueden elegir al cobrar por transferencia
 * (`carwash.charge`): la página 1 con el tope del API, ya como lista.
 */
export function useActiveBankAccounts(enabled = true): UseQueryResult<BankAccount[], ApiError> {
  return useQuery<Page<BankAccount>, ApiError, BankAccount[]>({
    queryKey: [...BANK_ACCOUNTS_QUERY_KEY, 'active'],
    queryFn: () => listBankAccounts({ active: true, pageSize: MAX_PAGE_SIZE }),
    select: (page) => page.items,
    enabled,
  });
}

function useBankAccountsInvalidation() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: BANK_ACCOUNTS_QUERY_KEY });
  };
}

export function useCreateBankAccount() {
  const invalidate = useBankAccountsInvalidation();

  return useMutation<BankAccount, ApiError, CreateBankAccountInput>({
    mutationFn: createBankAccount,
    onSuccess: invalidate,
  });
}

export function useUpdateBankAccount() {
  const invalidate = useBankAccountsInvalidation();

  return useMutation<BankAccount, ApiError, { id: string; input: UpdateBankAccountInput }>({
    mutationFn: ({ id, input }) => updateBankAccount(id, input),
    onSuccess: invalidate,
  });
}
