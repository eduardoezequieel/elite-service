import type { BankAccount, BankAccountType, BankCode } from '@elite/shared';

/**
 * Puerto de persistencia de las cuentas del negocio (069). En produccion lo
 * implementa Prisma; en los tests, una implementacion en memoria.
 */

export interface NewBankAccountData {
  bank: BankCode;
  type: BankAccountType;
  /** Ya sin guiones (RN-2). */
  number: string;
  holderName: string;
}

/** Cambios sobre una cuenta. Lo que no viene, no se toca. No hay borrar (RN-3). */
export interface BankAccountChanges {
  bank?: BankCode;
  type?: BankAccountType;
  number?: string;
  holderName?: string;
  active?: boolean;
}

export interface BankAccountRepository {
  /** `activeOnly` = solo las que se pueden elegir al cobrar. Orden: banco, numero. */
  list(activeOnly: boolean): Promise<BankAccount[]>;
  findById(id: string): Promise<BankAccount | null>;
  /** `exceptId` deja editar una cuenta sin chocar contra si misma. */
  existsByBankAndNumber(bank: string, number: string, exceptId?: string): Promise<boolean>;
  /** @throws BankAccountDuplicateError si el indice unico choca (carrera). */
  create(data: NewBankAccountData): Promise<BankAccount>;
  /** @throws BankAccountDuplicateError si el indice unico choca (carrera). */
  update(id: string, changes: BankAccountChanges): Promise<BankAccount>;
}

export const BANK_ACCOUNT_REPOSITORY = Symbol('banking.BankAccountRepository');
