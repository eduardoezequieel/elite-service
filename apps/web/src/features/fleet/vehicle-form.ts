import { createFleetVehicleSchema, updateFleetVehicleSchema } from '@elite/shared';
import type { FleetVehicle, FleetVehicleCategory, FleetVehicleStatus } from '@elite/shared';
import { z } from 'zod';

import { addDays } from '@/lib/civil-date';
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
 * El formulario de un carro de la flota (095): lo que se escribe, y cómo se
 * vuelve el cuerpo del pedido. Los nombres de campo son los del contrato, así
 * que un error del schema cae solo en su campo.
 */
export interface FleetVehicleFormValues {
  plate: string;
  make: string;
  model: string;
  year: string;
  color: string;
  category: FleetVehicleCategory;
  dailyRate: string;
  weeklyRate: string;
  monthlyRate: string;
  freeKmPerDay: string;
  extraKmPrice: string;
  odometerKm: string;
  purchasePrice: string;
  purchasedAt: string;
  financed: boolean;
  downPayment: string;
  installment: string;
  termMonths: string;
  financingStartedAt: string;
  insuranceMonthly: string;
  gpsMonthly: string;
  otherFixedMonthly: string;
  insuranceExpiresAt: string;
  registrationExpiresAt: string;
  /** Solo en la edición: el alta nace `ACTIVE` y el schema del alta lo descarta. */
  status: FleetVehicleStatus;
  notes: string;
}

export const EMPTY_FLEET_VEHICLE_FORM: FleetVehicleFormValues = {
  plate: '',
  make: '',
  model: '',
  year: '',
  color: '',
  category: 'SEDAN',
  dailyRate: '',
  weeklyRate: '',
  monthlyRate: '',
  freeKmPerDay: '',
  extraKmPrice: '',
  odometerKm: '',
  purchasePrice: '',
  purchasedAt: '',
  financed: false,
  downPayment: '',
  installment: '',
  termMonths: '',
  financingStartedAt: '',
  insuranceMonthly: '',
  gpsMonthly: '',
  otherFixedMonthly: '',
  insuranceExpiresAt: '',
  registrationExpiresAt: '',
  status: 'ACTIVE',
  notes: '',
};

const DATE_FIELDS = [
  'purchasedAt',
  'financingStartedAt',
  'insuranceExpiresAt',
  'registrationExpiresAt',
] as const;

/** Los valores de un carro existente, para editarlo. */
export function fleetVehicleFormValuesOf(vehicle: FleetVehicle): FleetVehicleFormValues {
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
    freeKmPerDay: numberToField(vehicle.freeKmPerDay),
    extraKmPrice: vehicle.extraKmPrice ?? '',
    odometerKm: numberToField(vehicle.odometerKm),
    purchasePrice: vehicle.purchasePrice ?? '',
    purchasedAt: civilToField(vehicle.purchasedAt),
    financed: vehicle.financed,
    downPayment: vehicle.downPayment ?? '',
    installment: vehicle.installment ?? '',
    termMonths: numberToField(vehicle.termMonths),
    financingStartedAt: civilToField(vehicle.financingStartedAt),
    insuranceMonthly: vehicle.insuranceMonthly ?? '',
    gpsMonthly: vehicle.gpsMonthly ?? '',
    otherFixedMonthly: vehicle.otherFixedMonthly ?? '',
    insuranceExpiresAt: civilToField(vehicle.insuranceExpiresAt),
    registrationExpiresAt: civilToField(vehicle.registrationExpiresAt),
    status: vehicle.status,
    notes: vehicle.notes ?? '',
  };
}

/**
 * El cuerpo del pedido. Sin financiamiento, sus cuatro campos se mandan en
 * `null`: lo que se escribió antes de destildarlo no queda guardado a medias.
 */
export function fleetVehicleDraft(values: FleetVehicleFormValues): Record<string, unknown> {
  const financed = values.financed;

  return {
    plate: textOrNull(values.plate) ?? '',
    make: values.make,
    model: values.model,
    year: wholeOrNull(values.year),
    color: textOrNull(values.color),
    category: values.category,
    dailyRate: values.dailyRate.trim().replace(',', '.'),
    weeklyRate: moneyOrNull(values.weeklyRate),
    monthlyRate: moneyOrNull(values.monthlyRate),
    freeKmPerDay: wholeOrNull(values.freeKmPerDay),
    extraKmPrice: moneyOrNull(values.extraKmPrice),
    odometerKm: wholeOrNull(values.odometerKm) ?? 0,
    purchasePrice: moneyOrNull(values.purchasePrice),
    purchasedAt: civilOrNull(values.purchasedAt),
    financed,
    downPayment: financed ? moneyOrNull(values.downPayment) : null,
    installment: financed ? moneyOrNull(values.installment) : null,
    termMonths: financed ? wholeOrNull(values.termMonths) : null,
    financingStartedAt: financed ? civilOrNull(values.financingStartedAt) : null,
    insuranceMonthly: moneyOrNull(values.insuranceMonthly),
    gpsMonthly: moneyOrNull(values.gpsMonthly),
    otherFixedMonthly: moneyOrNull(values.otherFixedMonthly),
    insuranceExpiresAt: civilOrNull(values.insuranceExpiresAt),
    registrationExpiresAt: civilOrNull(values.registrationExpiresAt),
    status: values.status,
    notes: textOrNull(values.notes),
  };
}

const formShape = z.custom<FleetVehicleFormValues>().superRefine((values, ctx) => {
  for (const field of DATE_FIELDS) {
    if (!isTypedDateValid(values[field])) {
      ctx.addIssue({ code: 'custom', path: [field], message: TYPED_DATE_MESSAGE });
    }
  }
});

/** El alta: las fechas se revisan en el formato en que se escriben y después manda el contrato. */
export const createFleetVehicleFormSchema = formShape
  .transform(fleetVehicleDraft)
  .pipe(createFleetVehicleSchema);

/** La edición: el mismo cuerpo, validado contra el schema de edición. */
export const updateFleetVehicleFormSchema = formShape
  .transform(fleetVehicleDraft)
  .pipe(updateFleetVehicleSchema);

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
