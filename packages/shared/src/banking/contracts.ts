/**
 * spec 069 — Cuentas bancarias del negocio: lo que devuelve `/api/banking`.
 *
 * El banco sale de una lista fija (RN-1): agregar uno es cambiar
 * {@link BANKS}, no la base. La columna `bank` guarda el código.
 */

/** Bancos de El Salvador, código estable en inglés/mayúsculas + nombre visible (RN-1). */
export const BANKS = [
  { code: 'AGRICOLA', name: 'Banco Agrícola' },
  { code: 'CUSCATLAN', name: 'Banco Cuscatlán' },
  { code: 'DAVIVIENDA', name: 'Banco Davivienda' },
  { code: 'BAC', name: 'BAC Credomatic' },
  { code: 'PROMERICA', name: 'Banco Promerica' },
  { code: 'HIPOTECARIO', name: 'Banco Hipotecario' },
  { code: 'AZUL', name: 'Banco Azul' },
  { code: 'ATLANTIDA', name: 'Banco Atlántida' },
  { code: 'INDUSTRIAL', name: 'Banco Industrial' },
  { code: 'ABANK', name: 'Abank' },
  { code: 'BFA', name: 'Banco de Fomento Agropecuario' },
  { code: 'FEDECREDITO', name: 'Fedecrédito' },
  { code: 'MIBANCO', name: 'Mi Banco' },
  { code: 'BANCOVI', name: 'Bancovi' },
] as const;

export type BankCode = (typeof BANKS)[number]['code'];

/** Los códigos solos, para `z.enum` y la validación. */
export const BANK_CODES = BANKS.map((bank) => bank.code) as [BankCode, ...BankCode[]];

/** Nombre visible por código: `BANK_NAMES.AGRICOLA` → «Banco Agrícola». */
export const BANK_NAMES = Object.fromEntries(BANKS.map((bank) => [bank.code, bank.name])) as Record<
  BankCode,
  string
>;

/** `true` si el texto es un código de {@link BANKS}. */
export function isBankCode(value: string): value is BankCode {
  return (BANK_CODES as string[]).includes(value);
}

/** Nombre visible de un código; si no está en la lista (dato viejo), el código tal cual. */
export function bankName(code: string): string {
  return isBankCode(code) ? BANK_NAMES[code] : code;
}

export const BANK_ACCOUNT_TYPES = ['SAVINGS', 'CHECKING'] as const;
export type BankAccountType = (typeof BANK_ACCOUNT_TYPES)[number];

/** Texto visible del tipo de cuenta. */
export const BANK_ACCOUNT_TYPE_LABELS: Record<BankAccountType, string> = {
  SAVINGS: 'Ahorro',
  CHECKING: 'Corriente',
};

/** Una cuenta del negocio (RN-2). `number` va sin guiones. */
export interface BankAccount {
  id: string;
  bank: BankCode;
  /** Nombre visible del banco, resuelto por el API desde {@link BANKS}. */
  bankName: string;
  type: BankAccountType;
  number: string;
  holderName: string;
  /** Inactiva = no se elige en cobros nuevos; los pagos viejos la conservan (RN-3). */
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * La cuenta a la que entró una transferencia, como la muestra un pago
 * (estampa, detalle, turno). `null` en pagos que no son `TRANSFER` y en
 * transferencias anteriores a la 069 («Sin cuenta»).
 */
export type PaymentBankAccount = Pick<BankAccount, 'id' | 'bank' | 'bankName' | 'type' | 'number'>;
