import type { PaymentBankAccount } from '@elite/shared';

import type { BankAccountDirectory } from '../ports/bank-account-directory';

/** Una cuenta del negocio como la ve el cobro en los tests (069). */
export interface InMemoryBankAccount extends PaymentBankAccount {
  active: boolean;
}

/**
 * Las cuentas del negocio en memoria, para el cobro (069 RN-8). La cuenta de
 * cobro en memoria las lee de aca para armar el `bankAccount` de cada pago.
 */
export class InMemoryBankAccountDirectory implements BankAccountDirectory {
  constructor(readonly accounts: InMemoryBankAccount[] = []) {}

  add(account: InMemoryBankAccount): InMemoryBankAccount {
    this.accounts.push(account);

    return account;
  }

  findActiveIds(ids: readonly string[]): Promise<string[]> {
    return Promise.resolve(
      this.accounts
        .filter((account) => account.active && ids.includes(account.id))
        .map((account) => account.id),
    );
  }

  /** La cuenta como la muestra un pago, activa o no; `null` si no existe. */
  paymentAccount(id: string | null): PaymentBankAccount | null {
    const account = this.accounts.find((candidate) => candidate.id === id);

    if (account === undefined) return null;

    return {
      id: account.id,
      bank: account.bank,
      bankName: account.bankName,
      type: account.type,
      number: account.number,
    };
  }
}
