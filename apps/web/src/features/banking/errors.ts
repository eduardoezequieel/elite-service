import { API_ERROR_CODES } from '@elite/shared';

/**
 * Los errores del API de cuentas (spec 069), en la frase de la pantalla y con
 * el campo donde se corrigen. El `message` del API queda como respaldo.
 */

export type BankAccountField = 'bank' | 'type' | 'number' | 'holderName';

const FIELDS: readonly BankAccountField[] = ['bank', 'type', 'number', 'holderName'];

export interface BankAccountErrorView {
  /** El mensaje general, al pie del formulario. */
  message: string;
  /** Los mensajes por campo. */
  fields: Partial<Record<BankAccountField, string>>;
}

function fieldMessages(details: unknown): Partial<Record<BankAccountField, string>> {
  if (typeof details !== 'object' || details === null) return {};

  const record = details as Record<string, unknown>;
  const result: Partial<Record<BankAccountField, string>> = {};

  for (const field of FIELDS) {
    const value = record[field];
    if (typeof value === 'string') result[field] = value;
    else if (Array.isArray(value) && typeof value[0] === 'string') result[field] = value[0];
  }

  return result;
}

export function bankAccountErrorView(error: {
  code: string;
  message: string;
  details?: unknown;
}): BankAccountErrorView {
  if (error.code === API_ERROR_CODES.BANK_ACCOUNT_DUPLICATE) {
    const message = 'Ya hay una cuenta registrada con ese banco y ese número.';

    return { message, fields: { number: message } };
  }

  if (error.code === API_ERROR_CODES.VALIDATION_ERROR) {
    return { message: error.message, fields: fieldMessages(error.details) };
  }

  return { message: error.message, fields: {} };
}
