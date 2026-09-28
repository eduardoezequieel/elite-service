import type { BankAccount, CreateBankAccountInput, UpdateBankAccountInput } from '@elite/shared';

import { apiFetch } from '@/lib/api';

/**
 * API de cuentas bancarias del negocio (spec 069). La lista entera pide
 * `banking.manage`; la de activas —la que usa el cobro— alcanza con
 * `carwash.charge`. No existe borrar: se desactiva (RN-3).
 */

export function listBankAccounts(options: { active?: boolean } = {}): Promise<BankAccount[]> {
  return apiFetch<BankAccount[]>(
    options.active === true ? '/banking/accounts?active=true' : '/banking/accounts',
  );
}

export function createBankAccount(input: CreateBankAccountInput): Promise<BankAccount> {
  return apiFetch<BankAccount>('/banking/accounts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateBankAccount(id: string, input: UpdateBankAccountInput): Promise<BankAccount> {
  return apiFetch<BankAccount>(`/banking/accounts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
