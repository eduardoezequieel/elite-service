import { createAgreementSchema, updateAgreementSchema } from '@elite/shared';
import type { PaymentMethod, RentalAgreement, RentalCoverage } from '@elite/shared';
import { z } from 'zod';

import { addDaysToField, civilAtTime, fieldToInstant, instantToField } from './datetime';
import {
  TYPED_DATE_MESSAGE,
  civilOrNull,
  civilToField,
  isTypedDateValid,
  moneyOrNull,
  textOrNull,
  wholeOrNull,
} from './form-draft';

/**
 * El formulario de una renta (096): lo que se escribe y cómo se vuelve el
 * cuerpo del pedido. Los nombres son los del contrato, así un error del schema
 * cae solo en su campo. Tarifa, días, CDW y deducible vacíos viajan ausentes:
 * el API pone la tarifa por tramo, los días con gracia y los de ajustes.
 */
export interface AgreementFormValues {
  customerId: string;
  vehicleId: string;
  /** `datetime-local` en la hora del taller. */
  plannedPickupAt: string;
  plannedReturnAt: string;
  pickupLocation: string;
  returnLocation: string;
  dailyRate: string;
  billableDays: string;
  cdwPerDay: string;
  deductible: string;
  coverage: RentalCoverage;
  includesVat: boolean;
  extraCharges: string;
  extraChargesNote: string;
  discount: string;
  deposit: string;
  /** `''` = sin método. */
  depositMethod: PaymentMethod | '';
  cardLast4: string;
  authorizationCode: string;
  authorizationAmount: string;
  /** `dd/mm/aaaa`. */
  authorizationDate: string;
  hasAdditionalDriver: boolean;
  driverName: string;
  driverLicenseNumber: string;
  driverLicenseExpiresAt: string;
  driverBirthDate: string;
  driverCountry: string;
  notes: string;
}

export const EMPTY_AGREEMENT_FORM: AgreementFormValues = {
  customerId: '',
  vehicleId: '',
  plannedPickupAt: '',
  plannedReturnAt: '',
  pickupLocation: 'Oficina',
  returnLocation: 'Oficina',
  dailyRate: '',
  billableDays: '',
  cdwPerDay: '',
  deductible: '',
  coverage: 'UNDEFINED',
  includesVat: true,
  extraCharges: '',
  extraChargesNote: '',
  discount: '',
  deposit: '',
  depositMethod: '',
  cardLast4: '',
  authorizationCode: '',
  authorizationAmount: '',
  authorizationDate: '',
  hasAdditionalDriver: false,
  driverName: '',
  driverLicenseNumber: '',
  driverLicenseExpiresAt: '',
  driverBirthDate: '',
  driverCountry: '',
  notes: '',
};

const TYPED_DATES = ['authorizationDate', 'driverLicenseExpiresAt', 'driverBirthDate'] as const;

/** Lo que llega por la URL desde el calendario o «¿Qué hay libre?». */
export interface AgreementPrefill {
  vehicleId?: string | null;
  /** Día civil (`YYYY-MM-DD`) o instante ISO. */
  from?: string | null;
  to?: string | null;
  customerId?: string | null;
}

/** Hora con la que se abre una reserva cuando solo llega el día. */
export const DEFAULT_PICKUP_TIME = '09:00';

function fieldOf(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return civilAtTime(value, DEFAULT_PICKUP_TIME);
  return instantToField(value);
}

/** Los valores de arranque: la URL manda; sin regreso, un día después de la salida. */
export function agreementFormDefaults(prefill: AgreementPrefill = {}): AgreementFormValues {
  const pickup = fieldOf(prefill.from);
  const returnAt = fieldOf(prefill.to) || (pickup === '' ? '' : addDaysToField(pickup, 1));

  return {
    ...EMPTY_AGREEMENT_FORM,
    customerId: prefill.customerId ?? '',
    vehicleId: prefill.vehicleId ?? '',
    plannedPickupAt: pickup,
    plannedReturnAt: returnAt,
  };
}

function driverOf(values: AgreementFormValues) {
  if (!values.hasAdditionalDriver) return null;

  return {
    name: values.driverName,
    licenseNumber: textOrNull(values.driverLicenseNumber),
    licenseExpiresAt: civilOrNull(values.driverLicenseExpiresAt),
    birthDate: civilOrNull(values.driverBirthDate),
    country: textOrNull(values.driverCountry),
  };
}

/** Los términos que comparten el alta y la edición. */
function termsDraft(values: AgreementFormValues) {
  return {
    pickupLocation: values.pickupLocation,
    returnLocation: values.returnLocation,
    dailyRate: moneyOrNull(values.dailyRate) ?? undefined,
    billableDays: wholeOrNull(values.billableDays) ?? undefined,
    cdwPerDay: moneyOrNull(values.cdwPerDay) ?? undefined,
    deductible: moneyOrNull(values.deductible) ?? undefined,
    coverage: values.coverage,
    includesVat: values.includesVat,
    extraCharges: moneyOrNull(values.extraCharges) ?? '0',
    extraChargesNote: textOrNull(values.extraChargesNote),
    discount: moneyOrNull(values.discount) ?? '0',
    deposit: moneyOrNull(values.deposit) ?? '0',
    depositMethod: values.depositMethod === '' ? null : values.depositMethod,
    cardLast4: textOrNull(values.cardLast4),
    authorizationCode: textOrNull(values.authorizationCode),
    authorizationAmount: moneyOrNull(values.authorizationAmount),
    authorizationDate: civilOrNull(values.authorizationDate),
    additionalDriver: driverOf(values),
    notes: textOrNull(values.notes),
  };
}

/** El cuerpo del alta (sin la entrega: «Entregar ahora» la agrega aparte). */
export function agreementDraft(values: AgreementFormValues): Record<string, unknown> {
  return {
    customerId: values.customerId,
    vehicleId: values.vehicleId,
    plannedPickupAt: fieldToInstant(values.plannedPickupAt) ?? '',
    plannedReturnAt: fieldToInstant(values.plannedReturnAt) ?? '',
    ...termsDraft(values),
  };
}

const formShape = z.custom<AgreementFormValues>().superRefine((values, ctx) => {
  for (const field of TYPED_DATES) {
    if (!isTypedDateValid(values[field])) {
      ctx.addIssue({ code: 'custom', path: [field], message: TYPED_DATE_MESSAGE });
    }
  }
  if (values.hasAdditionalDriver && values.driverName.trim() === '') {
    ctx.addIssue({
      code: 'custom',
      path: ['driverName'],
      message: 'Escribí el nombre del conductor adicional.',
    });
  }
});

export const createAgreementFormSchema = formShape
  .transform(agreementDraft)
  .pipe(createAgreementSchema);

/** Los valores de una renta existente, para editarla. */
export function agreementFormValuesOf(agreement: RentalAgreement): AgreementFormValues {
  const driver = agreement.additionalDriver;

  return {
    customerId: agreement.customerId,
    vehicleId: agreement.vehicleId,
    plannedPickupAt: instantToField(agreement.plannedPickupAt),
    plannedReturnAt: instantToField(agreement.plannedReturnAt),
    pickupLocation: agreement.pickupLocation,
    returnLocation: agreement.returnLocation,
    dailyRate: agreement.dailyRate,
    billableDays: String(agreement.billableDays),
    cdwPerDay: agreement.cdwPerDay,
    deductible: agreement.deductible,
    coverage: agreement.coverage,
    includesVat: agreement.includesVat,
    extraCharges: agreement.extraCharges,
    extraChargesNote: agreement.extraChargesNote ?? '',
    discount: agreement.discount,
    deposit: agreement.deposit,
    depositMethod: agreement.depositMethod ?? '',
    cardLast4: agreement.cardLast4 ?? '',
    authorizationCode: agreement.authorizationCode ?? '',
    authorizationAmount: agreement.authorizationAmount ?? '',
    authorizationDate: civilToField(agreement.authorizationDate),
    hasAdditionalDriver: driver !== null,
    driverName: driver?.name ?? '',
    driverLicenseNumber: driver?.licenseNumber ?? '',
    driverLicenseExpiresAt: civilToField(driver?.licenseExpiresAt ?? null),
    driverBirthDate: civilToField(driver?.birthDate ?? null),
    driverCountry: driver?.country ?? '',
    notes: agreement.notes ?? '',
  };
}

/**
 * El cuerpo de la edición: solo lo que cambió. Así, mover las fechas sin tocar
 * los días deja que el API los recalcule (RN-4). La salida planificada solo
 * viaja mientras la renta está reservada: en curso ya salió.
 */
export function agreementUpdateDraft(
  values: AgreementFormValues,
  original: AgreementFormValues,
  reserved: boolean,
): Record<string, unknown> {
  const full = (source: AgreementFormValues): Record<string, unknown> => ({
    ...(reserved ? { plannedPickupAt: fieldToInstant(source.plannedPickupAt) ?? '' } : {}),
    plannedReturnAt: fieldToInstant(source.plannedReturnAt) ?? '',
    ...termsDraft(source),
  });
  const next = full(values);
  const before = full(original);

  return Object.fromEntries(
    Object.entries(next).filter(
      ([key, value]) => JSON.stringify(value) !== JSON.stringify(before[key]),
    ),
  );
}

export function updateAgreementFormSchema(original: AgreementFormValues, reserved: boolean) {
  return formShape
    .transform((values) => agreementUpdateDraft(values, original, reserved))
    .pipe(updateAgreementSchema);
}

/** Los campos del formulario, para bajar los `details` de un 422. */
export const AGREEMENT_FORM_FIELDS = Object.keys(
  EMPTY_AGREEMENT_FORM,
) as (keyof AgreementFormValues)[];
