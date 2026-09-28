import { z } from 'zod';

import { queryFlagSchema } from '../schemas';
import { BANK_ACCOUNT_TYPES, BANK_CODES } from './contracts';

/**
 * spec 069 — Schemas de `/api/banking/accounts`.
 */

export const bankCodeSchema = z.enum(BANK_CODES, { message: 'Elegí el banco.' });

export const bankAccountTypeSchema = z.enum(BANK_ACCOUNT_TYPES, {
  message: 'Elegí si es de ahorro o corriente.',
});

/** Solo dígitos y guiones, 6 a 24 caracteres; se guarda sin guiones (RN-2). */
export const bankAccountNumberSchema = z
  .string()
  .trim()
  .min(6, { message: 'El número de cuenta necesita al menos 6 caracteres.' })
  .max(24, { message: 'El número de cuenta no puede pasar de 24 caracteres.' })
  .regex(/^[0-9-]+$/, { message: 'El número de cuenta solo lleva dígitos y guiones.' })
  .refine((value) => /\d/.test(value), { message: 'El número de cuenta necesita dígitos.' })
  .transform((value) => value.replace(/-/g, ''));

export const bankAccountHolderSchema = z
  .string()
  .trim()
  .min(2, { message: 'Escribí el titular de la cuenta.' })
  .max(80, { message: 'El titular no puede pasar de 80 caracteres.' });

export const createBankAccountSchema = z.object({
  bank: bankCodeSchema,
  type: bankAccountTypeSchema,
  number: bankAccountNumberSchema,
  holderName: bankAccountHolderSchema,
});
export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;

/** Editar, desactivar o reactivar (RN-3). No existe borrar. */
export const updateBankAccountSchema = z.object({
  bank: bankCodeSchema.optional(),
  type: bankAccountTypeSchema.optional(),
  number: bankAccountNumberSchema.optional(),
  holderName: bankAccountHolderSchema.optional(),
  active: z.boolean().optional(),
});
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>;

/**
 * `GET /banking/accounts?active=true`. Con `active=true` basta `carwash.charge`
 * (el cobro lista las cuentas); sin filtro pide `banking.manage`.
 */
export const bankAccountsQuerySchema = z.object({
  active: queryFlagSchema.optional(),
});
export type BankAccountsQuery = z.infer<typeof bankAccountsQuerySchema>;
