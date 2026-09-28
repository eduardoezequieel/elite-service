/**
 * Cómo se nombra una cuenta del negocio en pantalla (spec 069), sin React.
 *
 * El selector del cobro dice «Agrícola · Corriente · 0012345678»; la estampa
 * de un pago, «Agrícola ···5678». Las dos salen de acá para que la caja, el
 * lavado y la venta la escriban igual.
 */

import { BANK_ACCOUNT_TYPE_LABELS, type BankAccountType } from '@elite/shared';

/** Lo mínimo de una cuenta para nombrarla. */
export interface BankAccountLike {
  bankName: string;
  type: BankAccountType;
  number: string;
}

/**
 * El nombre corto del banco: «Banco Agrícola» → «Agrícola». Solo se quita
 * «Banco » cuando lo que sigue es un nombre propio: «Banco de Fomento
 * Agropecuario» sin el prefijo sería «de Fomento…», y ese se deja entero.
 */
export function bankShortName(bankName: string): string {
  const match = /^Banco (\p{Lu}.*)$/u.exec(bankName.trim());

  return match?.[1] ?? bankName.trim();
}

/** Los últimos cuatro dígitos, con la marca de que hay más: «···5678». */
export function maskedAccountNumber(number: string): string {
  const digits = number.replace(/\D/g, '');

  return digits.length <= 4 ? digits : `···${digits.slice(-4)}`;
}

/** La cuenta en el selector del cobro: «Agrícola · Corriente · 0012345678». */
export function bankAccountOptionLabel(account: BankAccountLike): string {
  return [
    bankShortName(account.bankName),
    BANK_ACCOUNT_TYPE_LABELS[account.type],
    account.number,
  ].join(' · ');
}

/** La cuenta en la estampa de un pago: «Agrícola ···5678». */
export function bankAccountShortLabel(
  account: Pick<BankAccountLike, 'bankName' | 'number'>,
): string {
  return `${bankShortName(account.bankName)} ${maskedAccountNumber(account.number)}`;
}
