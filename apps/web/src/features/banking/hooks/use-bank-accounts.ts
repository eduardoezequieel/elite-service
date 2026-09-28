'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type { BankAccount, CreateBankAccountInput, UpdateBankAccountInput } from '@elite/shared';

import type { ApiError } from '@/lib/api';
import { createBankAccount, listBankAccounts, updateBankAccount } from '../api';

/** Prefijo de todo lo de cuentas: la lista de ajustes y la de activas del cobro. */
export const BANK_ACCOUNTS_QUERY_KEY = ['banking', 'accounts'] as const;

/** Todas las cuentas, activas e inactivas (`banking.manage`). */
export function useBankAccounts(enabled = true): UseQueryResult<BankAccount[], ApiError> {
  return useQuery<BankAccount[], ApiError>({
    queryKey: [...BANK_ACCOUNTS_QUERY_KEY, 'all'],
    queryFn: () => listBankAccounts(),
    enabled,
  });
}

/** Las cuentas que se pueden elegir al cobrar por transferencia (`carwash.charge`). */
export function useActiveBankAccounts(enabled = true): UseQueryResult<BankAccount[], ApiError> {
  return useQuery<BankAccount[], ApiError>({
    queryKey: [...BANK_ACCOUNTS_QUERY_KEY, 'active'],
    queryFn: () => listBankAccounts({ active: true }),
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
