import type { RentalAgreement, RentalSettings } from '@elite/shared';

import { moneyOrNull, textOrNull } from '../rentals/form-draft';
import type { RentalSettingsFormValues } from './settings-form';
import type { TrackedField } from './settings-changes';

/**
 * La hoja del contrato en la vista previa de Ajustes (120). No es otra hoja:
 * son `ContractFront` y `ContractBack` de la 097 con un contrato en blanco y
 * los ajustes **sin guardar** del formulario.
 */

/** Las partes de la hoja que se marcan al editar un campo (`data-zone` del papel). */
export const SHEET_ZONES = ['head', 'contact', 'lessor', 'city', 'rates', 'pagare'] as const;
export type SheetZone = (typeof SHEET_ZONES)[number];

/** Dónde sale cada campo en el anverso. Los que no salen impresos no tienen zona. */
export const FIELD_ZONES: Partial<Record<TrackedField, SheetZone>> = {
  logoFileId: 'head',
  companyName: 'head',
  taxId: 'head',
  nrc: 'head',
  contractStartNumber: 'head',
  phones: 'contact',
  email: 'contact',
  address: 'contact',
  lessorName: 'lessor',
  city: 'city',
  defaultCdwPerDay: 'rates',
  defaultDeductible: 'rates',
  vatRate: 'rates',
  interestRate: 'pagare',
  lateInterestRate: 'pagare',
};

export function zoneOf(field: string | null | undefined): SheetZone | null {
  if (field === null || field === undefined) return null;

  return FIELD_ZONES[field as TrackedField] ?? null;
}

function wholeOr(text: string, fallback: number): number {
  const value = Number.parseInt(text.trim(), 10);

  return Number.isFinite(value) ? value : fallback;
}

/** Un porcentaje escrito, tolerante: lo que no se lee queda en `fallback`. */
function percentOr(text: string, fallback: string): string {
  const clean = text.trim().replace(',', '.');

  return /^\d{1,3}(\.\d{1,2})?$/.test(clean) ? clean : fallback;
}

const filled = (items: readonly string[]) =>
  items.map((item) => item.trim()).filter((item) => item !== '');

/**
 * Los ajustes tal como se están escribiendo, con la forma de `RentalSettings`.
 * Un número a medio escribir no rompe la hoja: cae a 0 o a vacío.
 */
export function previewSettings(
  values: RentalSettingsFormValues,
  logoUrl: string | null,
  updatedAt: string,
): RentalSettings {
  const interest = percentOr(values.interestRate, '');
  const lateInterest = percentOr(values.lateInterestRate, '');

  return {
    companyName: values.companyName.trim(),
    taxId: textOrNull(values.taxId),
    nrc: textOrNull(values.nrc),
    address: textOrNull(values.address),
    phones: textOrNull(values.phones),
    email: textOrNull(values.email),
    lessorName: values.lessorName.trim(),
    city: values.city.trim(),
    contractStartNumber: wholeOr(values.contractStartNumber, 0),
    vatRate: percentOr(values.vatRate, '0'),
    defaultCdwPerDay: moneyOrNull(values.defaultCdwPerDay),
    defaultDeductible: moneyOrNull(values.defaultDeductible),
    bufferHours: wholeOr(values.bufferHours, 0),
    graceHours: wholeOr(values.graceHours, 0),
    minDriverAge: wholeOr(values.minDriverAge, 0),
    kmAlert: wholeOr(values.kmAlert, 0),
    daysAlert: wholeOr(values.daysAlert, 0),
    interestRate: interest === '' ? null : interest,
    lateInterestRate: lateInterest === '' ? null : lateInterest,
    contractIntro: values.contractIntro,
    clauses: filled(values.clauses),
    accessories: filled(values.accessories),
    logoFileId: values.logoFileId,
    logoUrl: values.logoFileId === null ? null : logoUrl,
    updatedAt,
  };
}

/** Un monto que la hoja pueda leer: lo que no es monto queda en cero. */
function amountOrZero(amount: string | null): string {
  return amount !== null && /^\d+(\.\d{1,2})?$/.test(amount) ? amount : '0.00';
}

/**
 * Un contrato sin cliente, sin carro y sin fechas: las líneas quedan para
 * escribir a mano. Lleva el número inicial, el CDW y el deducible de los ajustes.
 */
export function blankAgreement(settings: RentalSettings): RentalAgreement {
  const zero = '0.00';

  return {
    id: 'preview',
    contractNumber: settings.contractStartNumber > 0 ? settings.contractStartNumber : null,
    status: 'RESERVED',
    derivedStatus: 'RESERVED',
    customerId: '',
    vehicleId: '',
    customer: {
      id: '',
      fullName: '',
      documentId: null,
      licenseNumber: null,
      licenseExpiresAt: null,
      birthDate: null,
      mobilePhone: null,
      phone: null,
      isBlocked: false,
    },
    vehicle: {
      id: '',
      plate: null,
      make: '',
      model: '',
      year: null,
      color: null,
      category: 'SEDAN',
      status: 'ACTIVE',
      odometerKm: 0,
      dailyRate: zero,
      weeklyRate: null,
      monthlyRate: null,
      freeKmPerDay: null,
      extraKmPrice: null,
    },
    plannedPickupAt: '',
    plannedReturnAt: '',
    actualPickupAt: null,
    actualReturnAt: null,
    pickupLocation: '',
    returnLocation: '',
    dailyRate: zero,
    billableDays: 0,
    cdwPerDay: amountOrZero(settings.defaultCdwPerDay),
    deductible: amountOrZero(settings.defaultDeductible),
    coverage: 'UNDEFINED',
    includesVat: Number(settings.vatRate) > 0,
    extraCharges: zero,
    extraChargesNote: null,
    discount: zero,
    extraKmCharge: zero,
    deposit: zero,
    depositMethod: null,
    depositReturnedAmount: null,
    depositReturnedAt: null,
    depositReturnNote: null,
    depositTransferredToId: null,
    cardLast4: null,
    authorizationCode: null,
    authorizationAmount: null,
    authorizationDate: null,
    additionalDriver: null,
    pickupInspection: null,
    returnInspection: null,
    pickupOdometerKm: null,
    returnOdometerKm: null,
    previousAgreementId: null,
    nextAgreementId: null,
    swapReason: null,
    cancelReason: null,
    cancelledAt: null,
    notes: null,
    createdAt: '',
    updatedAt: '',
    totals: { rental: zero, total: zero, paid: zero, balance: zero },
    depositHeld: zero,
    payments: [],
    fines: [],
    extensions: [],
  };
}
