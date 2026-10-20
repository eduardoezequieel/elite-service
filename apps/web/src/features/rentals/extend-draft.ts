import {
  agreementTotals,
  billableDays,
  centsToMoney,
  createPaymentSchema,
  extendSchema,
  moneyToCents,
} from '@elite/shared';
import type {
  AgreementTotals,
  CreatePaymentInput,
  ExtendInput,
  PaymentMethod,
  RentalAgreement,
} from '@elite/shared';

import { addDaysToField, fieldToInstant, instantToField } from './datetime';
import { moneyOrNull, textOrNull } from './form-draft';

/**
 * Extender una renta (127 RN-2), puro: el borrador del diálogo, la cuenta de
 * antes y después con `agreementTotals` de shared y los dos pedidos —la
 * extensión y, si se marca «Cobrar ahora», el pago—.
 */

/** Atajos: días que se agregan al regreso actual. */
export const EXTEND_QUICK_DAYS = [1, 2, 3, 7] as const;

export interface ExtendDraft {
  /** `datetime-local` en la hora del taller. */
  returnAt: string;
  /** Viene llena con la tarifa pactada (RN-2). */
  dailyRate: string;
  note: string;
  charge: boolean;
  payAmount: string;
  /** Mientras nadie lo escriba, el monto sigue a lo agregado. */
  payTouched: boolean;
  method: PaymentMethod;
}

/** Lo de la renta que entra a la cuenta de la extensión. */
export type ExtendSource = Pick<
  RentalAgreement,
  | 'plannedPickupAt'
  | 'actualPickupAt'
  | 'plannedReturnAt'
  | 'dailyRate'
  | 'cdwPerDay'
  | 'billableDays'
  | 'extraCharges'
  | 'extraKmCharge'
  | 'fuelCharge'
  | 'damageCharge'
  | 'discount'
  | 'fines'
  | 'payments'
  | 'totals'
>;

export function initialExtendDraft(agreement: Pick<ExtendSource, 'plannedReturnAt' | 'dailyRate'>) {
  return {
    returnAt: quickReturn(agreement, 1),
    dailyRate: agreement.dailyRate,
    note: '',
    charge: true,
    payAmount: '',
    payTouched: false,
    method: 'CASH',
  } satisfies ExtendDraft;
}

/** El regreso actual más `days` días, a la misma hora. */
export function quickReturn(
  agreement: Pick<ExtendSource, 'plannedReturnAt'>,
  days: number,
): string {
  return addDaysToField(instantToField(agreement.plannedReturnAt), days);
}

function centsOrNull(value: string): number | null {
  const amount = moneyOrNull(value);
  if (amount === null) return null;
  try {
    return moneyToCents(amount);
  } catch {
    return null;
  }
}

export interface ExtendPreview {
  /** `null` si la fecha no sirve: vacía o no posterior al regreso actual. */
  days: number | null;
  returnError: string | null;
  rateError: string | null;
  /** El monto a cobrar no se lee o pasa del saldo. */
  payError: string | null;
  /** `total después − total antes`, en centavos. */
  addedCents: number;
  after: AgreementTotals;
  /** Lo que se cobra ahora, en centavos (0 sin «Cobrar ahora»). */
  payCents: number;
  /** El saldo que queda después de extender y cobrar. */
  balanceCents: number;
  /** El monto que el campo muestra si nadie lo escribió. */
  suggestedPay: string;
}

/** La cuenta del diálogo: días, lo que agrega, el saldo y el total al pie. */
export function extendPreview(
  agreement: ExtendSource,
  draft: ExtendDraft,
  graceHours: number,
): ExtendPreview {
  const instant = fieldToInstant(draft.returnAt);
  const later =
    instant !== null && new Date(instant).getTime() > new Date(agreement.plannedReturnAt).getTime();
  const returnError =
    instant === null
      ? 'Elija la fecha y la hora.'
      : later
        ? null
        : 'Tiene que ser después del regreso actual.';
  const rateCents = centsOrNull(draft.dailyRate);
  const rateError = rateCents === null || rateCents <= 0 ? 'Escriba la tarifa por día.' : null;
  const start = agreement.actualPickupAt ?? agreement.plannedPickupAt;
  const days =
    returnError === null && instant !== null ? billableDays(start, instant, graceHours) : null;

  const after = agreementTotals({
    dailyRate:
      rateError === null && rateCents !== null ? centsToMoney(rateCents) : agreement.dailyRate,
    cdwPerDay: agreement.cdwPerDay,
    billableDays: days ?? agreement.billableDays,
    extraCharges: agreement.extraCharges,
    extraKmCharge: agreement.extraKmCharge,
    fuelCharge: agreement.fuelCharge,
    damageCharge: agreement.damageCharge,
    finesCharged: centsToMoney(
      agreement.fines
        .filter((fine) => fine.chargedToCustomer)
        .reduce((sum, fine) => sum + moneyToCents(fine.amount), 0),
    ),
    discount: agreement.discount,
    payments: agreement.payments,
  });
  const addedCents = moneyToCents(after.total) - moneyToCents(agreement.totals.total);
  const balanceAfter = moneyToCents(after.balance);
  const suggested = Math.max(0, Math.min(addedCents, balanceAfter));
  const typed = draft.payTouched ? centsOrNull(draft.payAmount) : suggested;
  const payCents = draft.charge && typed !== null ? Math.max(0, typed) : 0;
  const payError = !draft.charge
    ? null
    : typed === null && draft.payAmount.trim() !== ''
      ? 'Escriba un monto válido.'
      : payCents > Math.max(0, balanceAfter)
        ? `No puede pasar del saldo ($${centsToMoney(Math.max(0, balanceAfter))}).`
        : null;

  return {
    days,
    returnError,
    rateError,
    payError,
    addedCents,
    after,
    payCents,
    balanceCents: balanceAfter - payCents,
    suggestedPay: suggested > 0 ? centsToMoney(suggested) : '',
  };
}

type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

/** El cuerpo de `POST …/extend`. La tarifa viaja siempre: la que se ve es la que queda. */
export function extendBody(draft: ExtendDraft): Parsed<ExtendInput> {
  const parsed = extendSchema.safeParse({
    newReturnAt: fieldToInstant(draft.returnAt) ?? '',
    dailyRate: moneyOrNull(draft.dailyRate) ?? '',
    note: textOrNull(draft.note),
  });

  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, message: parsed.error.issues[0]?.message ?? 'Revise los datos.' };
}

/**
 * El pago del segundo pedido (como la entrega, 108), o `null` si no se cobra:
 * sin «Cobrar ahora» o con el monto en cero.
 */
export function extendPayment(
  draft: ExtendDraft,
  preview: Pick<ExtendPreview, 'payCents'>,
): Parsed<CreatePaymentInput> | null {
  if (!draft.charge || preview.payCents <= 0) return null;

  const parsed = createPaymentSchema.safeParse({
    amount: centsToMoney(preview.payCents),
    method: draft.method,
  });

  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, message: parsed.error.issues[0]?.message ?? 'Revise el cobro.' };
}
