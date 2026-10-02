import type {
  BankAccount,
  CreateBankAccountInput,
  Page,
  UpdateBankAccountInput,
} from '@elite/shared';

import { listQuery } from '@/features/inventory/list-query';
import { apiFetch } from '@/lib/api';

/**
 * API de cuentas bancarias del negocio (spec 069). La lista entera pide
 * `banking.manage`; la de activas —la que usa el cobro— alcanza con
 * `carwash.charge`. No existe borrar: se desactiva (RN-3). De a una página
 * (spec 102).
 */

export interface BankAccountsParams {
  /** `true` solo activas (lo que pide el cobro), `false` solo inactivas, sin él todas. */
  active?: boolean;
  page?: number;
  pageSize?: number;
}

export function listBankAccounts(params: BankAccountsParams = {}): Promise<Page<BankAccount>> {
  return apiFetch<Page<BankAccount>>(
    `/banking/accounts${listQuery({
      active: params.active,
      page: params.page,
      pageSize: params.pageSize,
    })}`,
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
