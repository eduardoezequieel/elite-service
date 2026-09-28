import { bankName } from '@elite/shared';
import type { BankAccount } from '@elite/shared';

import { BankAccountDuplicateError } from '../../domain/bank-account';
import type {
  BankAccountChanges,
  BankAccountRepository,
  NewBankAccountData,
} from '../ports/bank-account.repository';

/** Las cuentas del negocio en memoria, con el mismo indice unico que la base. */
export class InMemoryBankAccountRepository implements BankAccountRepository {
  readonly rows: BankAccount[] = [];
  private sequence = 0;

  list(activeOnly: boolean): Promise<BankAccount[]> {
    const rows = this.rows
      .filter((row) => !activeOnly || row.active)
      .sort((a, b) => a.bank.localeCompare(b.bank) || a.number.localeCompare(b.number));

    return Promise.resolve(rows.map((row) => ({ ...row })));
  }

  findById(id: string): Promise<BankAccount | null> {
    const row = this.rows.find((candidate) => candidate.id === id);

    return Promise.resolve(row === undefined ? null : { ...row });
  }

  existsByBankAndNumber(bank: string, number: string, exceptId?: string): Promise<boolean> {
    return Promise.resolve(this.taken(bank, number, exceptId));
  }

  create(data: NewBankAccountData): Promise<BankAccount> {
    if (this.taken(data.bank, data.number)) throw new BankAccountDuplicateError();

    this.sequence += 1;
    const now = new Date(Date.UTC(2026, 8, 26, 12, this.sequence)).toISOString();
    const row: BankAccount = {
      id: `00000000-0000-4000-8000-${String(this.sequence).padStart(12, '0')}`,
      bank: data.bank,
      bankName: bankName(data.bank),
      type: data.type,
      number: data.number,
      holderName: data.holderName,
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    this.rows.push(row);

    return Promise.resolve({ ...row });
  }

  update(id: string, changes: BankAccountChanges): Promise<BankAccount> {
    const row = this.rows.find((candidate) => candidate.id === id);

    if (row === undefined) throw new Error(`Unknown bank account ${id}`);

    const bank = changes.bank ?? row.bank;
    const number = changes.number ?? row.number;

    if (this.taken(bank, number, id)) throw new BankAccountDuplicateError();

    Object.assign(row, changes, { bankName: bankName(bank) });

    return Promise.resolve({ ...row });
  }

  private taken(bank: string, number: string, exceptId?: string): boolean {
    return this.rows.some(
      (row) => row.bank === bank && row.number === number && row.id !== exceptId,
    );
  }
}
