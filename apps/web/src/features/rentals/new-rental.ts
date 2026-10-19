import {
  agreementTotals,
  centsToMoney,
  createAgreementSchema,
  discountCeiling,
  moneyToCents,
} from '@elite/shared';
import type { CreateAgreementInput } from '@elite/shared';

import { addDays, type CivilDate, type CivilRange } from '@/lib/civil-date';
import { formatMoneyCompact, toCents } from '@/lib/money';

import {
  agreementDraft,
  agreementFormDefaults,
  type AgreementFormValues,
  type AgreementPrefill,
} from './agreement-form';
import { fieldToInstant } from './datetime';
import { isTypedDateValid, moneyOrNull } from './form-draft';

/**
 * Nueva renta en cuatro pasos (118): Carro → Cliente → Contrato → Confirmar.
 * Lo puro del asistente: el arranque según la URL, el rango con sus horas, el
 * dinero, lo que frena cada paso y el cuerpo del alta.
 */

export const NEW_RENTAL_STEPS = ['Carro', 'Cliente', 'Contrato', 'Confirmar'] as const;
export type NewRentalStep = 1 | 2 | 3 | 4;

/** Lo que se escribe: el formulario de la renta más el «Sí/No» del seguro. */
export interface NewRentalValues extends AgreementFormValues {
  insurance: boolean;
}

export interface NewRentalStart {
  values: NewRentalValues;
  step: NewRentalStep;
}

/**
 * El arranque: la URL manda. Con carro (y las fechas, que siempre hay) empieza
 * en Cliente; con carro y cliente, en Contrato.
 */
export function newRentalStart(prefill: AgreementPrefill = {}, today?: CivilDate): NewRentalStart {
  const values: NewRentalValues = { ...agreementFormDefaults(prefill, today), insurance: false };
  const step: NewRentalStep = values.vehicleId === '' ? 1 : values.customerId === '' ? 2 : 3;

  return { values, step };
}

/** El rango del calendario: los días de salida y regreso. */
export function rangeOfFields(pickupAt: string, returnAt: string): CivilRange {
  return { from: pickupAt.slice(0, 10), to: returnAt.slice(0, 10) };
}

/**
 * Lo elegido en el calendario, conservando las horas. Un solo día es salir y
 * volver al siguiente.
 */
export function fieldsOfRange(
  range: CivilRange,
  pickupAt: string,
  returnAt: string,
): { pickupAt: string; returnAt: string } {
  const to = range.to > range.from ? range.to : addDays(range.from, 1);

  return {
    pickupAt: `${range.from}${pickupAt.slice(10) || 'T11:00'}`,
    returnAt: `${to}${returnAt.slice(10) || 'T11:00'}`,
  };
}

/** Cambia la hora (`HH:mm`) de un campo `YYYY-MM-DDTHH:mm`. */
export function withTime(field: string, time: string): string {
  return /^\d{2}:\d{2}$/.test(time) ? `${field.slice(0, 10)}T${time}` : field;
}

/** `true` si las dos fechas están completas y el regreso es después de la salida. */
export function validRange(pickupAt: string, returnAt: string): boolean {
  const from = fieldToInstant(pickupAt);
  const to = fieldToInstant(returnAt);

  return from !== null && to !== null && Date.parse(to) > Date.parse(from);
}

/** Un monto escrito en centavos (con coma o punto), o `null` si no se lee. Vacío es cero. */
export function typedCents(text: string): number | null {
  return toCents(moneyOrNull(text) ?? '0');
}

/** Lo que cuesta: la tarifa y los días que da la disponibilidad, y el CDW de ajustes. */
export interface NewRentalPrice {
  dailyRate: string;
  billableDays: number;
  /** CDW por día de ajustes (o `'0.00'`). */
  cdwPerDay: string;
}

export interface NewRentalMoney {
  /** CDW que entra: el de ajustes con seguro, cero sin él. */
  cdwPerDay: string;
  /** `(tarifa + CDW) × días`: el tope del descuento (RN-1). */
  subtotal: string;
  /** El descuento leído, o `'0.00'` si no se lee. */
  discount: string;
  total: string;
}

export function newRentalMoney(values: NewRentalValues, price: NewRentalPrice): NewRentalMoney {
  const cdwPerDay = values.insurance ? price.cdwPerDay : '0.00';
  const subtotal = discountCeiling({
    dailyRate: price.dailyRate,
    cdwPerDay,
    billableDays: price.billableDays,
    extraCharges: '0.00',
    extraKmCharge: '0.00',
    finesCharged: '0.00',
  });
  const discount = centsToMoney(Math.max(0, typedCents(values.discount) ?? 0));
  const { total } = agreementTotals({
    dailyRate: price.dailyRate,
    cdwPerDay,
    billableDays: price.billableDays,
    extraCharges: '0.00',
    extraKmCharge: '0.00',
    finesCharged: '0.00',
    discount,
    payments: [],
  });

  return { cdwPerDay, subtotal, discount, total };
}

/** Lo que se sabe del cliente elegido para dejarlo seguir. */
export interface ChosenCustomer {
  licenseExpired: boolean;
  /** «No rentar» o inactivo. */
  blocked: boolean;
}

export interface StepContext {
  price: NewRentalPrice | null;
  customer: ChosenCustomer | null;
}

/** Por qué no se puede pasar del paso `step`, o `null`. Mismos textos que el prototipo. */
export function newRentalStepError(
  step: NewRentalStep,
  values: NewRentalValues,
  context: StepContext,
): string | null {
  if (step === 1) {
    if (!validRange(values.plannedPickupAt, values.plannedReturnAt)) return 'Revise las fechas';
    if (values.vehicleId === '') return 'Elija un carro';
  }
  if (step === 2) {
    if (values.customerId === '' || context.customer === null) return 'Elija un cliente';
    if (context.customer.blocked) return 'No rentar';
    if (context.customer.licenseExpired) return 'La licencia está vencida';
  }
  if (step === 3) {
    const discount = typedCents(values.discount);
    if (discount === null || discount < 0) return 'Revise el descuento';
    if (context.price !== null) {
      const { subtotal } = newRentalMoney(values, context.price);
      if (discount > moneyToCents(subtotal)) {
        return `El descuento no puede pasar de ${formatMoneyCompact(subtotal)}`;
      }
    }
    if (values.insurance) {
      const deductible = typedCents(values.deductible);
      if (deductible === null || deductible <= 0) return 'Falta el deducible';
    }
    if (typedCents(values.deposit) === null) return 'Revise la garantía';
    if (values.hasAdditionalDriver) {
      if (values.driverName.trim() === '') return 'Falta el nombre del conductor';
      if (
        !isTypedDateValid(values.driverLicenseExpiresAt) ||
        !isTypedDateValid(values.driverBirthDate)
      ) {
        return 'Revise las fechas del conductor';
      }
    }
  }

  return null;
}

/** El primer paso antes de `target` que todavía frena, o `null` si se llega. */
export function firstBlockedStep(
  target: NewRentalStep,
  values: NewRentalValues,
  context: StepContext,
): { step: NewRentalStep; message: string } | null {
  for (let step = 1 as NewRentalStep; step < target; step = (step + 1) as NewRentalStep) {
    const message = newRentalStepError(step, values, context);
    if (message !== null) return { step, message };
  }

  return null;
}

/** ¿Se puede llevar hoy? Solo si la salida es hoy (o ya pasó). */
export function leavesToday(pickupAt: string, today: CivilDate): boolean {
  return pickupAt.slice(0, 10) <= today;
}

/**
 * El cuerpo del alta. Con seguro, CDW de ajustes y el deducible escrito; sin
 * él, CDW en cero y la cobertura declinada. La entrega no viaja acá: la hace
 * el asistente de la ficha.
 */
export function newRentalBody(
  values: NewRentalValues,
  cdwPerDay: string,
): { ok: true; value: CreateAgreementInput } | { ok: false; message: string } {
  const draft = agreementDraft({
    ...values,
    coverage: values.insurance ? 'ACCEPTED' : 'DECLINED',
    cdwPerDay: values.insurance ? cdwPerDay : '0.00',
    deductible: values.insurance ? values.deductible : '',
  });
  const parsed = createAgreementSchema.safeParse(draft);

  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Revise los datos.' };

  return { ok: true, value: parsed.data };
}
