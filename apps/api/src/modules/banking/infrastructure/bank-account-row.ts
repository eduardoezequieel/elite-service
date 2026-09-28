import { bankName } from '@elite/shared';
import type {
  BankAccount,
  BankCode,
  PaymentBankAccount,
  PaymentMethodDetails,
} from '@elite/shared';
import type { BankAccount as BankAccountRow, Prisma } from '@prisma/client';

/**
 * Como se lee una cuenta del negocio de la base (069).
 *
 * Vive aparte del repositorio porque lo usan tambien los que leen pagos —el
 * lavado, la cuenta de cobro, la venta suelta y el turno—: si cada uno armara
 * su `bankAccount`, la estampa y el turno podrian nombrar distinto la misma
 * cuenta.
 */

/** Lo que un pago trae de su cuenta: sin titular ni fechas. */
export const PAYMENT_BANK_ACCOUNT_SELECT = {
  select: { id: true, bank: true, type: true, number: true },
} satisfies Prisma.BankAccountDefaultArgs;

type PaymentBankAccountRow = Prisma.BankAccountGetPayload<typeof PAYMENT_BANK_ACCOUNT_SELECT>;

/** La columna guarda un codigo de `BANKS`; el schema de shared lo valido al escribir. */
function bankCodeOf(value: string): BankCode {
  return value as BankCode;
}

export function toBankAccount(row: BankAccountRow): BankAccount {
  return {
    id: row.id,
    bank: bankCodeOf(row.bank),
    bankName: bankName(row.bank),
    type: row.type,
    number: row.number,
    holderName: row.holderName,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPaymentBankAccount(row: PaymentBankAccountRow): PaymentBankAccount {
  return {
    id: row.id,
    bank: bankCodeOf(row.bank),
    bankName: bankName(row.bank),
    type: row.type,
    number: row.number,
  };
}

/** Los datos de la 069 de una fila de `payments` que se leyo con su cuenta. */
export function paymentDetailsOf(row: {
  bankAccount: PaymentBankAccountRow | null;
  reference: string | null;
  description: string | null;
}): PaymentMethodDetails {
  return {
    bankAccount: row.bankAccount === null ? null : toPaymentBankAccount(row.bankAccount),
    reference: row.reference,
    description: row.description,
  };
}
