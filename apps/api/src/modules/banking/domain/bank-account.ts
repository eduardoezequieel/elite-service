import { BANK_ACCOUNT_TYPE_LABELS, bankName } from '@elite/shared';
import type { BankAccountType } from '@elite/shared';

/**
 * Cuentas bancarias del negocio (069): reglas puras, sin Nest ni Prisma.
 *
 * Que el banco sea de la lista fija (RN-1) y que el numero sea de digitos lo
 * valida el schema de `@elite/shared`; aca queda como se nombra una cuenta
 * cuando la lee alguien que tiene que cuadrar contra el banco.
 */

/** Lo minimo de una cuenta para nombrarla. */
export interface BankAccountIdentity {
  bank: string;
  type: BankAccountType;
  number: string;
}

/** Cuantos digitos del final se muestran de un numero de cuenta. */
const VISIBLE_DIGITS = 4;

/** `0012345678` → `···5678`. Un numero mas corto que eso sale entero. */
export function maskAccountNumber(number: string): string {
  if (number.length <= VISIBLE_DIGITS) return number;

  return `···${number.slice(-VISIBLE_DIGITS)}`;
}

/**
 * Como sale una cuenta en el desglose del turno (RN-7):
 * «Banco Agrícola · Corriente · ···5678».
 */
export function bankAccountLabel(account: BankAccountIdentity): string {
  return [
    bankName(account.bank),
    BANK_ACCOUNT_TYPE_LABELS[account.type],
    maskAccountNumber(account.number),
  ].join(' · ');
}

/** Ya hay una cuenta con ese banco y ese numero (RN-2). */
export class BankAccountDuplicateError extends Error {
  constructor() {
    super('A bank account with that bank and number already exists');
    this.name = 'BankAccountDuplicateError';
  }
}
