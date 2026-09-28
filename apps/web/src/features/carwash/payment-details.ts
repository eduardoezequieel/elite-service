/**
 * Lo que un renglón de pago pide según su método (spec 069), sin React.
 *
 * - `TRANSFER`: la cuenta del negocio a la que entró y la referencia del
 *   comprobante (RN-4).
 * - `OTHER`: qué fue, en texto libre corto (RN-5).
 * - `CASH` y `CARD`: nada, y no se manda nada (RN-6).
 *
 * El API vuelve a validar lo mismo con el schema de `@elite/shared`; esto le
 * dice al cajero qué falta antes de apretar «Cobrar», y arma el cuerpo sin
 * campos de otro método.
 */

import {
  API_ERROR_CODES,
  PAYMENT_DESCRIPTION_MAX_LENGTH,
  PAYMENT_REFERENCE_MAX_LENGTH,
  type PaymentMethod,
} from '@elite/shared';

/** Los datos del método, como están en los campos. Vacío = no escrito. */
export interface PaymentDetailsDraft {
  bankAccountId?: string;
  reference?: string;
  description?: string;
}

/** Lo que viaja en el renglón del cobro: solo lo del método. */
export interface PaymentDetailsInput {
  bankAccountId?: string;
  reference?: string;
  description?: string;
}

/**
 * La cuenta que de verdad vale para el renglón: la elegida si sigue activa; si
 * no hay elegida y hay **una sola** cuenta activa, esa (queda elegida sola); si
 * no, ninguna. Una cuenta que se desactivó mientras el cobro estaba abierto deja
 * de valer y hay que elegir otra.
 */
export function effectiveBankAccountId(
  chosen: string | undefined,
  activeAccountIds: readonly string[],
): string | undefined {
  if (chosen !== undefined && activeAccountIds.includes(chosen)) return chosen;
  if (activeAccountIds.length === 1) return activeAccountIds[0];

  return undefined;
}

/** El borrador con la cuenta resuelta por {@link effectiveBankAccountId}. */
export function withEffectiveAccount<T extends PaymentDetailsDraft & { method: PaymentMethod }>(
  line: T,
  activeAccountIds: readonly string[],
): T {
  if (line.method !== 'TRANSFER') return line;

  const bankAccountId = effectiveBankAccountId(line.bankAccountId, activeAccountIds);

  return bankAccountId === line.bankAccountId ? line : { ...line, bankAccountId };
}

/**
 * Por qué este renglón todavía no se puede cobrar, con la frase del botón.
 * `null` cuando está completo. Si se pasan las cuentas activas, la elegida
 * tiene que estar entre ellas.
 */
export function paymentDetailsBlocker(
  method: PaymentMethod,
  details: PaymentDetailsDraft,
  activeAccountIds?: readonly string[],
): string | null {
  if (method === 'TRANSFER') {
    if (activeAccountIds !== undefined && activeAccountIds.length === 0) {
      return 'No hay cuentas registradas';
    }

    const account = details.bankAccountId;

    if (
      account === undefined ||
      account === '' ||
      (activeAccountIds !== undefined && !activeAccountIds.includes(account))
    ) {
      return 'Elegí la cuenta';
    }

    const reference = (details.reference ?? '').trim();

    if (reference === '') return 'Falta la referencia';
    if (reference.length > PAYMENT_REFERENCE_MAX_LENGTH) return 'Referencia muy larga';

    return null;
  }

  if (method === 'OTHER') {
    const description = (details.description ?? '').trim();

    if (description === '') return 'Falta qué fue el pago';
    if (description.length > PAYMENT_DESCRIPTION_MAX_LENGTH) return 'Descripción muy larga';
  }

  return null;
}

/** Los campos del renglón que pide su método, recortados. Nada de otro método (RN-6). */
export function paymentDetailsInput(
  method: PaymentMethod,
  details: PaymentDetailsDraft,
): PaymentDetailsInput {
  if (method === 'TRANSFER') {
    return {
      ...(details.bankAccountId ? { bankAccountId: details.bankAccountId } : {}),
      ...((details.reference ?? '').trim() !== ''
        ? { reference: (details.reference ?? '').trim() }
        : {}),
    };
  }

  if (method === 'OTHER') {
    const description = (details.description ?? '').trim();

    return description === '' ? {} : { description };
  }

  return {};
}

/**
 * El mensaje de un cobro rechazado, con los códigos de la 069 dichos en la
 * frase del cajero. Lo demás, el `message` del API tal cual.
 */
export function chargeErrorMessage(error: { code: string; message: string }): string {
  if (error.code === API_ERROR_CODES.BANK_ACCOUNT_UNAVAILABLE) {
    return 'La cuenta elegida ya no está activa. Elegí otra y volvé a cobrar. No se cobró nada.';
  }

  return error.message;
}

/**
 * Por qué «Transferencia» no se puede elegir todavía, o `null` si se puede
 * (069): mientras llegan las cuentas, si no llegaron, o si no hay ninguna
 * activa.
 */
export function transferUnavailableReason(accounts: {
  isPending: boolean;
  isError: boolean;
  count: number;
}): string | null {
  if (accounts.count > 0) return null;
  if (accounts.isPending) return 'Cargando cuentas…';
  if (accounts.isError) return 'No se pudieron cargar las cuentas';

  return 'No hay cuentas registradas';
}
