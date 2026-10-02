import { createFleetVehicleSchema, moneyToCents, updateFleetVehicleSchema } from '@elite/shared';
import type { FleetVehicle, FleetVehicleCategory } from '@elite/shared';
import { z } from 'zod';

import { addDays, parseCivil } from '@/lib/civil-date';
import {
  TYPED_DATE_MESSAGE,
  civilOrNull,
  civilToField,
  isTypedDateValid,
  moneyOrNull,
  numberToField,
  textOrNull,
  wholeOrNull,
} from '../rentals/form-draft';

/**
 * Los formularios de un carro de la flota (095, partidos en la 103): el alta
 * corta y un formulario por tarjeta de la ficha. Los nombres de campo son los
 * del contrato, así que un error del schema cae solo en su campo.
 */

// ===================== Alta corta =====================

/** «Nuevo carro»: lo justo para rentarlo. Lo demás se llena en la ficha. */
export interface FleetVehicleCreateValues {
  plate: string;
  make: string;
  model: string;
  year: string;
  color: string;
  category: FleetVehicleCategory;
  dailyRate: string;
  odometerKm: string;
}

export const EMPTY_FLEET_VEHICLE_CREATE: FleetVehicleCreateValues = {
  plate: '',
  make: '',
  model: '',
  year: '',
  color: '',
  category: 'SEDAN',
  dailyRate: '',
  odometerKm: '',
};

const plateField = (value: string) => textOrNull(value) ?? '';
const rateField = (value: string) => value.trim().replace(',', '.');

/** El cuerpo del alta: solo estos campos; el resto nace vacío. */
export function fleetVehicleCreateDraft(values: FleetVehicleCreateValues): Record<string, unknown> {
  return {
    plate: plateField(values.plate),
    make: values.make,
    model: values.model,
    year: wholeOrNull(values.year),
    color: textOrNull(values.color),
    category: values.category,
    dailyRate: rateField(values.dailyRate),
    odometerKm: wholeOrNull(values.odometerKm) ?? 0,
  };
}

export const createFleetVehicleFormSchema = z
  .custom<FleetVehicleCreateValues>()
  .transform(fleetVehicleCreateDraft)
  .pipe(createFleetVehicleSchema);

// ===================== Una tarjeta de la ficha =====================

export const FLEET_VEHICLE_CARDS = [
  'identity',
  'rates',
  'purchase',
  'fixed',
  'documents',
  'notes',
] as const;
export type FleetVehicleCard = (typeof FLEET_VEHICLE_CARDS)[number];

export const FLEET_VEHICLE_CARD_TITLES: Record<FleetVehicleCard, string> = {
  identity: 'Identificación',
  rates: 'Tarifas y km',
  purchase: 'Compra y financiamiento',
  fixed: 'Costos fijos mensuales',
  documents: 'Seguro y circulación',
  notes: 'Notas',
};

/** Las tarjetas de costo (RN-1): bajo llave para quien no tiene `rentals.reports`. */
export const FLEET_COST_CARDS: readonly FleetVehicleCard[] = ['purchase', 'fixed'];

/** Lo que se escribe en cualquiera de los diálogos de tarjeta. */
export interface FleetVehicleSectionValues {
  plate: string;
  make: string;
  model: string;
  year: string;
  color: string;
  category: FleetVehicleCategory;
  dailyRate: string;
  weeklyRate: string;
  monthlyRate: string;
  /** Solo del formulario: apagado, km libre (`freeKmPerDay` y `extraKmPrice` en `null`). */
  limitedKm: boolean;
  freeKmPerDay: string;
  extraKmPrice: string;
  purchasePrice: string;
  purchasedAt: string;
  financed: boolean;
  downPayment: string;
  installment: string;
  termMonths: string;
  financingStartedAt: string;
  installmentIncludesExtras: boolean;
  insuranceMonthly: string;
  gpsMonthly: string;
  otherFixedMonthly: string;
  insurer: string;
  policyNumber: string;
  insuranceExpiresAt: string;
  registrationExpiresAt: string;
  notes: string;
}

/** `true` si el km es libre: sin tope o con tope 0. */
export function hasFreeKm(vehicle: Pick<FleetVehicle, 'freeKmPerDay'>): boolean {
  return vehicle.freeKmPerDay === null || vehicle.freeKmPerDay === 0;
}

/** RN-2: la cuota del financiamiento ya trae seguro y GPS. */
export function extrasInInstallment(
  vehicle: Pick<FleetVehicle, 'financed' | 'installmentIncludesExtras'>,
): boolean {
  return vehicle.financed && vehicle.installmentIncludesExtras;
}

/** Los valores de un carro existente, para cualquiera de sus tarjetas. */
export function fleetVehicleSectionValuesOf(vehicle: FleetVehicle): FleetVehicleSectionValues {
  return {
    plate: vehicle.plate ?? '',
    make: vehicle.make,
    model: vehicle.model,
    year: numberToField(vehicle.year),
    color: vehicle.color ?? '',
    category: vehicle.category,
    dailyRate: vehicle.dailyRate,
    weeklyRate: vehicle.weeklyRate ?? '',
    monthlyRate: vehicle.monthlyRate ?? '',
    limitedKm: !hasFreeKm(vehicle),
    freeKmPerDay: numberToField(vehicle.freeKmPerDay),
    extraKmPrice: vehicle.extraKmPrice ?? '',
    purchasePrice: vehicle.purchasePrice ?? '',
    purchasedAt: civilToField(vehicle.purchasedAt),
    financed: vehicle.financed,
    downPayment: vehicle.downPayment ?? '',
    installment: vehicle.installment ?? '',
    termMonths: numberToField(vehicle.termMonths),
    financingStartedAt: civilToField(vehicle.financingStartedAt),
    installmentIncludesExtras: vehicle.installmentIncludesExtras,
    insuranceMonthly: vehicle.insuranceMonthly ?? '',
    gpsMonthly: vehicle.gpsMonthly ?? '',
    otherFixedMonthly: vehicle.otherFixedMonthly ?? '',
    insurer: vehicle.insurer ?? '',
    policyNumber: vehicle.policyNumber ?? '',
    insuranceExpiresAt: civilToField(vehicle.insuranceExpiresAt),
    registrationExpiresAt: civilToField(vehicle.registrationExpiresAt),
    notes: vehicle.notes ?? '',
  };
}

/** Las fechas que se escriben dd/mm/aaaa en cada tarjeta. */
const CARD_DATES: Record<FleetVehicleCard, readonly (keyof FleetVehicleSectionValues)[]> = {
  identity: [],
  rates: [],
  purchase: ['purchasedAt', 'financingStartedAt'],
  fixed: [],
  documents: ['insuranceExpiresAt', 'registrationExpiresAt'],
  notes: [],
};

/**
 * El cuerpo del `PATCH` de una tarjeta: **solo** sus campos. Sin
 * financiamiento, sus campos viajan en `null` y la bandera en `false`; con km
 * libre, sus dos campos en `null`. Si la cuota trae seguro y GPS, la tarjeta de
 * costos no los manda: quedan como estaban.
 */
export function fleetVehicleSectionDraft(
  card: FleetVehicleCard,
  values: FleetVehicleSectionValues,
): Record<string, unknown> {
  switch (card) {
    case 'identity':
      return {
        plate: plateField(values.plate),
        make: values.make,
        model: values.model,
        year: wholeOrNull(values.year),
        color: textOrNull(values.color),
        category: values.category,
      };
    case 'rates':
      return {
        dailyRate: rateField(values.dailyRate),
        weeklyRate: moneyOrNull(values.weeklyRate),
        monthlyRate: moneyOrNull(values.monthlyRate),
        freeKmPerDay: values.limitedKm ? wholeOrNull(values.freeKmPerDay) : null,
        extraKmPrice: values.limitedKm ? moneyOrNull(values.extraKmPrice) : null,
      };
    case 'purchase': {
      const financed = values.financed;

      return {
        purchasePrice: moneyOrNull(values.purchasePrice),
        purchasedAt: civilOrNull(values.purchasedAt),
        financed,
        downPayment: financed ? moneyOrNull(values.downPayment) : null,
        installment: financed ? moneyOrNull(values.installment) : null,
        termMonths: financed ? wholeOrNull(values.termMonths) : null,
        financingStartedAt: financed ? civilOrNull(values.financingStartedAt) : null,
        installmentIncludesExtras: financed && values.installmentIncludesExtras,
      };
    }
    case 'fixed':
      return extrasInInstallment(values)
        ? { otherFixedMonthly: moneyOrNull(values.otherFixedMonthly) }
        : {
            insuranceMonthly: moneyOrNull(values.insuranceMonthly),
            gpsMonthly: moneyOrNull(values.gpsMonthly),
            otherFixedMonthly: moneyOrNull(values.otherFixedMonthly),
          };
    case 'documents':
      return {
        insurer: textOrNull(values.insurer),
        policyNumber: textOrNull(values.policyNumber),
        insuranceExpiresAt: civilOrNull(values.insuranceExpiresAt),
        registrationExpiresAt: civilOrNull(values.registrationExpiresAt),
      };
    case 'notes':
      return { notes: textOrNull(values.notes) };
  }
}

/** El schema del diálogo de una tarjeta: fechas en el formato en que se escriben y después el contrato. */
export function fleetVehicleSectionFormSchema(card: FleetVehicleCard) {
  return z
    .custom<FleetVehicleSectionValues>()
    .superRefine((values, ctx) => {
      for (const field of CARD_DATES[card]) {
        if (!isTypedDateValid(String(values[field]))) {
          ctx.addIssue({ code: 'custom', path: [field], message: TYPED_DATE_MESSAGE });
        }
      }
    })
    .transform((values) => fleetVehicleSectionDraft(card, values))
    .pipe(updateFleetVehicleSchema);
}

// ===================== Lo que muestra la ficha =====================

/** Una tarifa en 0 o vacía no aplica: así la lee `rateForDays` de `rentals/money.ts` (RN-4). */
function rateApplies(amount: string | null): amount is string {
  return amount !== null && amount.trim() !== '' && moneyToCents(amount) > 0;
}

/**
 * A qué cae una tarifa vacía, como cotiza hoy `rateForDays` (RN-4): la de 7+
 * a la diaria; la de 30+ a la de 7+ si existe, si no a la diaria. `null` si
 * la tarifa tiene monto propio.
 */
export function rateFallback(
  vehicle: Pick<FleetVehicle, 'weeklyRate' | 'monthlyRate'>,
  rate: 'weeklyRate' | 'monthlyRate',
): string | null {
  if (rateApplies(vehicle[rate])) return null;
  if (rate === 'monthlyRate' && rateApplies(vehicle.weeklyRate)) return 'Igual que la de 7+';

  return 'Igual que la diaria';
}

/** «mmm aaaa» del avance, como el prototipo aprobado. */
const SHORT_MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/** El avance de un financiamiento: «Cuota N de M · faltan K · termina en mmm aaaa». */
export interface FinancingProgress {
  paid: number;
  term: number;
  left: number;
  /** «mar 2029»: el mes de la última cuota. */
  endsIn: string;
}

/**
 * Cuántas cuotas van desde la primera (la del mes de inicio cuenta) hasta el
 * mes de `today`. Sin financiamiento, plazo o inicio, no hay avance.
 */
export function financingProgress(
  vehicle: Pick<FleetVehicle, 'financed' | 'termMonths' | 'financingStartedAt'>,
  today: string,
): FinancingProgress | null {
  const { financed, termMonths: term, financingStartedAt: start } = vehicle;

  if (!financed || term === null || term <= 0 || start === null) return null;

  const [startYear, startMonth] = start.split('-').map(Number) as [number, number];
  const [year, month] = today.split('-').map(Number) as [number, number];
  const elapsed = (year - startYear) * 12 + (month - startMonth) + 1;
  const paid = Math.max(0, Math.min(term, elapsed));
  const lastIndex = startMonth - 1 + term - 1;

  return {
    paid,
    term,
    left: term - paid,
    endsIn: `${SHORT_MONTHS[lastIndex % 12] ?? ''} ${startYear + Math.floor(lastIndex / 12)}`,
  };
}

/** El sello de un vencimiento: ámbar dentro del aviso, rojo si ya pasó. */
export type ExpiryMark = { tone: 'amber' | 'red'; label: string } | null;

export function expiryMark(date: string | null, today: string, daysAlert: number): ExpiryMark {
  if (date === null) return null;

  const days = Math.round((parseCivil(date).getTime() - parseCivil(today).getTime()) / 86_400_000);

  if (days < 0) return { tone: 'red', label: 'Vencido' };
  if (days > daysAlert) return null;
  if (days === 0) return { tone: 'amber', label: 'Vence hoy' };

  return { tone: 'amber', label: days === 1 ? 'Vence en 1 día' : `Vence en ${days} días` };
}

// ===================== La lista =====================

/** Un vencimiento a la vista: seguro o tarjeta de circulación. */
export interface FleetExpiry {
  label: string;
  date: string;
  /** Ya pasó. */
  overdue: boolean;
}

/**
 * Los vencimientos que ya pasaron o caen dentro de `withinDays` días desde hoy
 * (el aviso de días de los ajustes). Lo que no tiene fecha no avisa.
 */
export function upcomingExpiries(
  vehicle: Pick<FleetVehicle, 'insuranceExpiresAt' | 'registrationExpiresAt'>,
  today: string,
  withinDays: number,
): FleetExpiry[] {
  const limit = addDays(today, withinDays);
  const candidates = [
    { label: 'Seguro', date: vehicle.insuranceExpiresAt },
    { label: 'Tarjeta de circulación', date: vehicle.registrationExpiresAt },
  ];

  return candidates.flatMap(({ label, date }) =>
    date !== null && date <= limit ? [{ label, date, overdue: date < today }] : [],
  );
}
