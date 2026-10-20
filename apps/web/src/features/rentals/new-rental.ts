import {
  AVAILABILITY_LABELS,
  agreementTotals,
  centsToMoney,
  createAgreementSchema,
  discountCeiling,
  fleetVehicleName,
  moneyToCents,
} from '@elite/shared';
import type { AvailabilityRow, CreateAgreementInput, FleetVehicleCategory } from '@elite/shared';

import { foldText } from '@/features/inventory/delivery';

import { addDays, type CivilDate, type CivilRange } from '@/lib/civil-date';
import { formatMoneyCompact, toCents } from '@/lib/money';

import {
  agreementDraft,
  agreementFormDefaults,
  type AgreementFormValues,
  type AgreementPrefill,
} from './agreement-form';
import { dayShort } from './available-range';
import { addDaysToField, fieldToInstant, instantToCivil } from './datetime';
import { isTypedDateValid, moneyOrNull } from './form-draft';

/**
 * Nueva renta en cuatro pasos (118): Carro → Cliente → Contrato → Confirmar.
 * Lo puro del asistente: el arranque según la URL, el rango con sus horas, el
 * dinero, lo que frena cada paso y el cuerpo del alta.
 */

export const NEW_RENTAL_STEPS = ['Carro', 'Cliente', 'Contrato', 'Confirmar'] as const;
export type NewRentalStep = 1 | 2 | 3 | 4;

/**
 * Lo que se escribe: el formulario de la renta más «Si choca el carro» (124):
 * `insurance` es la cobertura de daños, con el cargo por día y el deducible de
 * esta renta.
 */
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
export function newRentalStart(
  prefill: AgreementPrefill = {},
  today?: CivilDate,
  now?: string,
): NewRentalStart {
  const defaults = agreementFormDefaults(prefill, today);
  const values: NewRentalValues = {
    ...defaults,
    ...(now === undefined
      ? {}
      : notBeforeNow(defaults.plannedPickupAt, defaults.plannedReturnAt, now)),
    insurance: false,
  };
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

/**
 * La salida no queda antes de ahora (118): si ya pasó, sube a `now` (el cuarto
 * de hora siguiente) y el regreso, si quedó detrás, a un día después.
 */
export function notBeforeNow(
  pickupAt: string,
  returnAt: string,
  now: string,
): { plannedPickupAt: string; plannedReturnAt: string } {
  if (pickupAt >= now) return { plannedPickupAt: pickupAt, plannedReturnAt: returnAt };

  return {
    plannedPickupAt: now,
    plannedReturnAt: returnAt > now ? returnAt : addDaysToField(now, 1),
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

/**
 * Se puede elegir para la renta: libre, o en la calle con regreso planificado
 * antes de la salida (más el margen). El API acepta los dos.
 */
export function isPickable(row: Pick<AvailabilityRow, 'availability'>): boolean {
  return row.availability === 'FREE' || row.availability === 'FREE_IF_RETURNED';
}

/** El chip de un carro que sigue en la calle: «Vuelve sáb 17 oct». `null` si está libre. */
export function returnsChip(
  row: Pick<AvailabilityRow, 'availability' | 'blocking'>,
): string | null {
  if (row.availability !== 'FREE_IF_RETURNED') return null;
  if (row.blocking === null) return AVAILABILITY_LABELS.FREE_IF_RETURNED;

  return `Vuelve ${dayShort(instantToCivil(row.blocking.plannedReturnAt))}`;
}

/**
 * La lista de carros elegibles, ya filtrada (118): primero los libres y después
 * los que vuelven antes de la salida; dentro de cada grupo, por precio y placa.
 */
export function freeCars(
  rows: readonly AvailabilityRow[],
  query: string,
  category: FleetVehicleCategory | '',
): AvailabilityRow[] {
  const term = foldText(query.trim());

  return rows
    .filter(isPickable)
    .filter((row) => category === '' || row.vehicle.category === category)
    .filter(
      (row) =>
        term === '' ||
        [row.vehicle.plate ?? '', fleetVehicleName(row.vehicle)].some((text) =>
          foldText(text).includes(term),
        ),
    )
    .sort(
      (left, right) =>
        Number(left.availability !== 'FREE') - Number(right.availability !== 'FREE') ||
        Number(left.estimatedTotal) - Number(right.estimatedTotal) ||
        (left.vehicle.plate ?? '').localeCompare(right.vehicle.plate ?? '', 'es'),
    );
}

/** Un monto escrito en centavos (con coma o punto), o `null` si no se lee. Vacío es cero. */
export function typedCents(text: string): number | null {
  return toCents(moneyOrNull(text) ?? '0');
}

/** Lo que cuesta: la tarifa y los días que da la disponibilidad. */
export interface NewRentalPrice {
  dailyRate: string;
  billableDays: number;
}

export interface NewRentalMoney {
  /** CDW que entra: el escrito con cobertura, cero sin ella. */
  cdwPerDay: string;
  /** `(tarifa + CDW) × días`: el tope del descuento (RN-1). */
  subtotal: string;
  /** El descuento leído, o `'0.00'` si no se lee. */
  discount: string;
  total: string;
}

export function newRentalMoney(values: NewRentalValues, price: NewRentalPrice): NewRentalMoney {
  const cdwPerDay = values.insurance
    ? centsToMoney(Math.max(0, typedCents(values.cdwPerDay) ?? 0))
    : '0.00';
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
  /** Ahora, como campo `YYYY-MM-DDTHH:mm` (`nowField`). */
  now: string;
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
    if (values.plannedPickupAt < context.now) return 'La salida ya pasó';
    if (values.vehicleId === '') return 'Elija un carro';
  }
  if (step === 2) {
    if (values.customerId === '' || context.customer === null) return 'Elija un cliente';
    if (context.customer.blocked) return 'No rentar';
    if (context.customer.licenseExpired) return 'La licencia está vencida';
  }
  if (step === 3) {
    if (values.insurance) {
      const cdw = typedCents(values.cdwPerDay);
      if (cdw === null || cdw < 0) return 'Revise el cargo por día';
      const deductible = typedCents(values.deductible);
      if (deductible === null || deductible <= 0) return 'Falta cuánto paga si choca';
    }
    const discount = typedCents(values.discount);
    if (discount === null || discount < 0) return 'Revise el descuento';
    if (context.price !== null) {
      const { subtotal } = newRentalMoney(values, context.price);
      if (discount > moneyToCents(subtotal)) {
        return `El descuento no puede pasar de ${formatMoneyCompact(subtotal)}`;
      }
    }
    const deposit = typedCents(values.deposit);
    if (deposit === null || deposit < 0) return 'Revise la garantía';
    if (deposit > 0 && values.depositMethod === '') return 'Falta el método de la garantía';
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
 * El cuerpo del alta. Con cobertura, el cargo y el deducible escritos (vacío es
 * cargo cero, no el de ajustes); sin ella, CDW en cero y la cobertura
 * declinada. La entrega no viaja acá: la hace el asistente de la ficha.
 */
export function newRentalBody(
  values: NewRentalValues,
): { ok: true; value: CreateAgreementInput } | { ok: false; message: string } {
  const draft = agreementDraft({
    ...values,
    coverage: values.insurance ? 'ACCEPTED' : 'DECLINED',
    cdwPerDay: values.insurance && values.cdwPerDay.trim() !== '' ? values.cdwPerDay : '0.00',
    deductible: values.insurance ? values.deductible : '',
    // Sin garantía no hay método: el que quedó elegido antes de borrarla no viaja.
    depositMethod: (typedCents(values.deposit) ?? 0) > 0 ? values.depositMethod : '',
  });
  const parsed = createAgreementSchema.safeParse(draft);

  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Revise los datos.' };

  return { ok: true, value: parsed.data };
}
