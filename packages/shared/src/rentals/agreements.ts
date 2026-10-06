import { z } from 'zod';

import type { PaymentMethod } from '../contracts';
import {
  civilDateSchema,
  moneySchema,
  pageQueryShape,
  paymentMethodSchema,
  queryFlagSchema,
} from '../schemas';
import type { RentalFine, RentalPayment } from './billing';
import type { FleetVehicleCategory, FleetVehicleStatus } from './fleet';
import { FLEET_VEHICLE_CATEGORIES } from './fleet';
import { centsToMoney, moneyToCents } from './money';
import type { AgreementTotals } from './money';

/**
 * spec 096 — Las rentas de la rentadora: reserva, entrega, recepción,
 * extensión, cambio de carro, calendario y «¿Qué hay libre?».
 *
 * Una renta nace `RESERVED`, pasa a `IN_PROGRESS` al entregar el carro y
 * termina `FINISHED` al recibirlo, o `CANCELLED`. `LATE` no se guarda: es una
 * renta en curso cuyo regreso planificado ya pasó (RN-1).
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// ---------------------------------------------------------------------------
// Estados
// ---------------------------------------------------------------------------

export const AGREEMENT_STATUSES = ['RESERVED', 'IN_PROGRESS', 'FINISHED', 'CANCELLED'] as const;
export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number];

/** El estado que se ve: el guardado más `LATE`, que se deriva (RN-1). */
export const AGREEMENT_DERIVED_STATUSES = [
  'RESERVED',
  'IN_PROGRESS',
  'LATE',
  'FINISHED',
  'CANCELLED',
] as const;
export type AgreementDerivedStatus = (typeof AGREEMENT_DERIVED_STATUSES)[number];

export const AGREEMENT_STATUS_LABELS: Record<AgreementDerivedStatus, string> = {
  RESERVED: 'Reservada',
  IN_PROGRESS: 'En la calle',
  LATE: 'Atrasada',
  FINISHED: 'Devuelta',
  CANCELLED: 'Cancelada',
};

/** Solo estas ocupan el carro (RN-2). */
export const OCCUPYING_STATUSES: readonly AgreementStatus[] = ['RESERVED', 'IN_PROGRESS'];

export const RENTAL_COVERAGES = ['UNDEFINED', 'ACCEPTED', 'DECLINED'] as const;
export type RentalCoverage = (typeof RENTAL_COVERAGES)[number];

export const RENTAL_COVERAGE_LABELS: Record<RentalCoverage, string> = {
  UNDEFINED: 'Sin definir',
  ACCEPTED: 'Acepta la cobertura',
  DECLINED: 'Declina la cobertura',
};

// ---------------------------------------------------------------------------
// Inspección (RN-7)
// ---------------------------------------------------------------------------

export const INSPECTION_ZONES = [
  'hood',
  'roof',
  'trunk',
  'front_bumper',
  'rear_bumper',
  'windshield',
  'rear_window',
  'left_front_fender',
  'left_front_door',
  'left_rear_door',
  'left_rear_fender',
  'right_front_fender',
  'right_front_door',
  'right_rear_door',
  'right_rear_fender',
  'left_mirror',
  'right_mirror',
  'wheels',
] as const;
export type InspectionZone = (typeof INSPECTION_ZONES)[number];

export const INSPECTION_ZONE_LABELS: Record<InspectionZone, string> = {
  hood: 'Capó',
  roof: 'Techo',
  trunk: 'Baúl',
  front_bumper: 'Bumper delantero',
  rear_bumper: 'Bumper trasero',
  windshield: 'Parabrisas',
  rear_window: 'Vidrio trasero',
  left_front_fender: 'Guardafango delantero izquierdo',
  left_front_door: 'Puerta delantera izquierda',
  left_rear_door: 'Puerta trasera izquierda',
  left_rear_fender: 'Guardafango trasero izquierdo',
  right_front_fender: 'Guardafango delantero derecho',
  right_front_door: 'Puerta delantera derecha',
  right_rear_door: 'Puerta trasera derecha',
  right_rear_fender: 'Guardafango trasero derecho',
  left_mirror: 'Espejo izquierdo',
  right_mirror: 'Espejo derecho',
  wheels: 'Llantas y aros',
};

/** El tanque se lee en octavos: 0 vacío, 8 lleno. */
export const FUEL_EIGHTHS_MAX = 8;

/** «6/8», «Lleno», «Vacío». */
export function fuelLabel(eighths: number): string {
  if (eighths <= 0) return 'Vacío';
  if (eighths >= FUEL_EIGHTHS_MAX) return 'Lleno';
  return `${eighths}/${FUEL_EIGHTHS_MAX}`;
}

/** Tope de fotos por inspección. */
export const INSPECTION_MAX_PHOTOS = 24;

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { message: `${label} no puede pasar de ${max} caracteres.` })
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

const odometerSchema = z
  .number({ message: 'Escribí el kilometraje.' })
  .int({ message: 'El kilometraje es un número entero.' })
  .min(0, { message: 'El kilometraje no puede ser negativo.' })
  .max(2_000_000, { message: 'Ese kilometraje no es real.' });

export const inspectionDamageSchema = z.object({
  zone: z.enum(INSPECTION_ZONES, { message: 'Elegí la zona del daño.' }),
  description: z
    .string()
    .trim()
    .max(300, { message: 'La descripción no puede pasar de 300 caracteres.' }),
});
export type InspectionDamage = z.infer<typeof inspectionDamageSchema>;

/** La inspección de entrega o de regreso (RN-7). Exige km y combustible (RN-8). */
export const rentalInspectionSchema = z.object({
  odometerKm: odometerSchema,
  fuelEighths: z
    .number({ message: 'Marcá el combustible.' })
    .int({ message: 'El combustible va en octavos.' })
    .min(0, { message: 'El combustible va de 0 a 8 octavos.' })
    .max(FUEL_EIGHTHS_MAX, { message: 'El combustible va de 0 a 8 octavos.' }),
  damages: z.array(inspectionDamageSchema).max(60, { message: 'Demasiados daños.' }).default([]),
  /** Accesorio de los ajustes → si estaba. */
  accessories: z.record(z.string().max(80), z.boolean()).default({}),
  tires: z
    .object({
      front: optionalText(80, 'Las llantas delanteras'),
      rear: optionalText(80, 'Las llantas traseras'),
    })
    .default({}),
  battery: optionalText(80, 'La batería'),
  photoIds: z
    .array(z.uuid({ message: 'Esa foto no es válida.' }))
    .max(INSPECTION_MAX_PHOTOS, { message: `No más de ${INSPECTION_MAX_PHOTOS} fotos.` })
    .default([]),
  notes: optionalText(1000, 'La nota'),
});
export type RentalInspection = z.output<typeof rentalInspectionSchema>;
export type RentalInspectionInput = z.input<typeof rentalInspectionSchema>;

/**
 * Los daños de la recepción en zonas que la entrega tenía sanas (RN-8). Sin
 * inspección de salida, todo lo marcado al regreso es nuevo.
 */
export function newDamages(
  pickup: Pick<RentalInspection, 'damages'> | null,
  returned: Pick<RentalInspection, 'damages'>,
): InspectionDamage[] {
  const before = new Set((pickup?.damages ?? []).map((damage) => damage.zone));

  return returned.damages.filter((damage) => !before.has(damage.zone));
}

/** Los accesorios que se marcaron como ausentes. */
export function missingAccessories(inspection: Pick<RentalInspection, 'accessories'>): string[] {
  return Object.entries(inspection.accessories)
    .filter(([, present]) => !present)
    .map(([name]) => name);
}

// ---------------------------------------------------------------------------
// Entradas
// ---------------------------------------------------------------------------

/** Un instante ISO con zona (`2026-10-12T16:00:00.000Z`). */
export const instantSchema = z.iso.datetime({
  offset: true,
  message: 'Escribí la fecha y la hora.',
});

const requiredText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .min(1, { message })
    .max(max, { message: `No puede pasar de ${max} caracteres.` });

const positiveMoney = moneySchema.refine((value) => moneyToCents(value) > 0, {
  message: 'El monto tiene que ser mayor que cero.',
});

const billableDaysSchema = z
  .number({ message: 'Escribí los días.' })
  .int({ message: 'Los días son un número entero.' })
  .min(1, { message: 'Al menos un día.' })
  .max(3650, { message: 'Demasiados días.' });

export const additionalDriverSchema = z.object({
  name: requiredText(120, 'Escribí el nombre del conductor adicional.'),
  licenseNumber: optionalText(30, 'La licencia'),
  licenseExpiresAt: civilDateSchema.nullable().optional(),
  birthDate: civilDateSchema.nullable().optional(),
  country: optionalText(60, 'El país'),
});
export type AdditionalDriver = z.output<typeof additionalDriverSchema>;

/** Un pago que llega junto con la entrega o la recepción. */
export const agreementPaymentSchema = z.object({
  amount: positiveMoney,
  method: paymentMethodSchema,
  reference: optionalText(40, 'La referencia'),
  note: optionalText(300, 'La nota'),
});
export type AgreementPaymentInput = z.output<typeof agreementPaymentSchema>;

/** RN-6: de la tarjeta de garantía solo los últimos cuatro dígitos. */
const cardLast4Schema = z
  .string()
  .trim()
  .regex(/^\d{4}$/, { message: 'Solo los últimos 4 dígitos de la tarjeta.' })
  .nullable()
  .optional();

/** Los campos de la renta que se escriben en el alta y se pueden editar después. */
const agreementTermsShape = {
  pickupLocation: requiredText(120, 'Escribí dónde se entrega.'),
  returnLocation: requiredText(120, 'Escribí dónde se devuelve.'),
  /** Vacío: la tarifa por tramo del carro (`rateForDays`). */
  dailyRate: moneySchema.optional(),
  /** Vacío: `billableDays()` con la gracia de ajustes. */
  billableDays: billableDaysSchema.optional(),
  /** Vacío: el de ajustes. */
  cdwPerDay: moneySchema.optional(),
  deductible: moneySchema.optional(),
  coverage: z.enum(RENTAL_COVERAGES, { message: 'Elegí la cobertura.' }),
  includesVat: z.boolean(),
  extraCharges: moneySchema,
  extraChargesNote: optionalText(300, 'El detalle de los cargos'),
  discount: moneySchema,
  deposit: moneySchema,
  depositMethod: paymentMethodSchema.nullable().optional(),
  cardLast4: cardLast4Schema,
  authorizationCode: optionalText(40, 'El código de autorización'),
  authorizationAmount: moneySchema.nullable().optional(),
  authorizationDate: civilDateSchema.nullable().optional(),
  additionalDriver: additionalDriverSchema.nullable().optional(),
  notes: optionalText(2000, 'La nota'),
};

/** `POST /rentals/agreements/:id/checkout`: RESERVED → IN_PROGRESS. */
export const checkoutSchema = z.object({
  actualPickupAt: instantSchema,
  inspection: rentalInspectionSchema,
  deposit: moneySchema.optional(),
  depositMethod: paymentMethodSchema.nullable().optional(),
  payment: agreementPaymentSchema.optional(),
});
export type CheckoutInput = z.output<typeof checkoutSchema>;

const withReturnAfterPickup = <T extends { plannedPickupAt: string; plannedReturnAt: string }>(
  value: T,
) => new Date(value.plannedReturnAt).getTime() > new Date(value.plannedPickupAt).getTime();

const RETURN_AFTER_PICKUP = {
  message: 'El regreso tiene que ser después de la salida.',
  path: ['plannedReturnAt'],
};

/** `POST /rentals/agreements`. Con `checkoutNow` entrega en el mismo paso y exige `checkout`. */
export const createAgreementSchema = z
  .object({
    customerId: z.uuid({ message: 'Elegí el cliente.' }),
    vehicleId: z.uuid({ message: 'Elegí el carro.' }),
    plannedPickupAt: instantSchema,
    plannedReturnAt: instantSchema,
    ...agreementTermsShape,
    pickupLocation: agreementTermsShape.pickupLocation.default('Oficina'),
    returnLocation: agreementTermsShape.returnLocation.default('Oficina'),
    coverage: agreementTermsShape.coverage.default('UNDEFINED'),
    includesVat: agreementTermsShape.includesVat.default(true),
    extraCharges: agreementTermsShape.extraCharges.default('0.00'),
    discount: agreementTermsShape.discount.default('0.00'),
    deposit: agreementTermsShape.deposit.default('0.00'),
    checkoutNow: z.boolean().default(false),
    checkout: checkoutSchema.optional(),
  })
  .refine(withReturnAfterPickup, RETURN_AFTER_PICKUP)
  .refine((value) => !value.checkoutNow || value.checkout !== undefined, {
    message: 'Para entregar ahora hace falta la inspección de salida.',
    path: ['checkout'],
  });
export type CreateAgreementInput = z.output<typeof createAgreementSchema>;

/**
 * `PATCH /rentals/agreements/:id`: solo `RESERVED` o `IN_PROGRESS`. Lo que no
 * viene no se toca. Cambiar las fechas revalida los choques; la salida
 * planificada solo se mueve mientras está reservada.
 */
export const updateAgreementSchema = z
  .object({
    plannedPickupAt: instantSchema,
    plannedReturnAt: instantSchema,
    ...agreementTermsShape,
  })
  .partial();
export type UpdateAgreementInput = z.output<typeof updateAgreementSchema>;

/** `POST /rentals/agreements/:id/checkin`: IN_PROGRESS → FINISHED. */
export const checkinSchema = z.object({
  actualReturnAt: instantSchema,
  inspection: rentalInspectionSchema,
  /** Para sobreescribir los días calculados (RN-4); va con nota. */
  billableDays: billableDaysSchema.optional(),
  billableDaysNote: optionalText(300, 'La nota de los días'),
  /** Cobrar los km por encima de los libres. */
  chargeExtraKm: z.boolean().default(true),
  payment: agreementPaymentSchema.optional(),
  depositReturn: z
    .object({
      amount: moneySchema,
      method: paymentMethodSchema.nullable().optional(),
      note: optionalText(300, 'La nota'),
    })
    .optional(),
  notes: optionalText(2000, 'La nota'),
});
export type CheckinInput = z.output<typeof checkinSchema>;

/** `POST /rentals/agreements/:id/extend`: nueva fecha de regreso, posterior a la actual. */
export const extendSchema = z.object({
  newReturnAt: instantSchema,
  /** Vacío: la misma tarifa. */
  dailyRate: moneySchema.optional(),
  note: optionalText(300, 'La nota'),
});
export type ExtendInput = z.output<typeof extendSchema>;

/** `POST /rentals/agreements/:id/swap`: cierra la renta en `at` y abre otra con el carro nuevo. */
export const swapSchema = z.object({
  at: instantSchema,
  newVehicleId: z.uuid({ message: 'Elegí el carro nuevo.' }),
  /** Vacío: la tarifa por tramo del carro nuevo. */
  dailyRate: moneySchema.optional(),
  reason: requiredText(300, 'Escribí por qué se cambia el carro.'),
});
export type SwapInput = z.output<typeof swapSchema>;

/** `POST /rentals/agreements/:id/reassign`: solo una reserva cambia de carro. */
export const reassignSchema = z.object({
  vehicleId: z.uuid({ message: 'Elegí el carro.' }),
  /** Vacío: la tarifa que ya tenía. */
  dailyRate: moneySchema.optional(),
});
export type ReassignInput = z.output<typeof reassignSchema>;

export const cancelSchema = z.object({
  reason: requiredText(300, 'Escribí por qué se cancela.'),
});
export type CancelInput = z.output<typeof cancelSchema>;

/** `status` llega repetido (`?status=A&status=B`) o separado por comas. */
const statusListSchema = z.preprocess(
  (value) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item !== '')
      : value,
  z.array(z.enum(AGREEMENT_STATUSES, { message: 'Ese estado no existe.' })),
);

/**
 * `GET /rentals/agreements` → `Page<RentalAgreementSummary>` (101). `from`/`to` son
 * días civiles: rentas que tocan ese rango.
 */
export const agreementsQuerySchema = z.object({
  ...pageQueryShape,
  status: statusListSchema.optional(),
  /** Solo las atrasadas (en curso con el regreso ya pasado). */
  late: queryFlagSchema.optional(),
  customerId: z.uuid({ message: 'Cliente inválido.' }).optional(),
  vehicleId: z.uuid({ message: 'Carro inválido.' }).optional(),
  from: civilDateSchema.optional(),
  to: civilDateSchema.optional(),
  /** Nombre del cliente, placa o número de contrato. */
  q: z.string().trim().max(60).optional(),
});
export type AgreementsQuery = z.output<typeof agreementsQuerySchema>;

/** `GET /rentals/availability?from&to&category`: instantes, con hora. */
export const availabilityQuerySchema = z
  .object({
    from: instantSchema,
    to: instantSchema,
    category: z.enum(FLEET_VEHICLE_CATEGORIES, { message: 'Ese tipo no existe.' }).optional(),
  })
  .refine((value) => new Date(value.to).getTime() > new Date(value.from).getTime(), {
    message: 'El regreso tiene que ser después de la salida.',
    path: ['to'],
  });
export type AvailabilityQuery = z.output<typeof availabilityQuerySchema>;

/** Tope del calendario: un mes y unos días. */
export const CALENDAR_MAX_DAYS = 42;

/** `GET /rentals/calendar?from&to`: días civiles, ambos incluidos. */
export const calendarQuerySchema = z
  .object({ from: civilDateSchema, to: civilDateSchema })
  .refine((value) => value.to >= value.from, {
    message: 'El rango termina antes de empezar.',
    path: ['to'],
  })
  .refine(
    (value) =>
      (Date.parse(`${value.to}T00:00:00Z`) - Date.parse(`${value.from}T00:00:00Z`)) / DAY_MS <
      CALENDAR_MAX_DAYS,
    { message: `El calendario muestra hasta ${CALENDAR_MAX_DAYS} días.`, path: ['to'] },
  );
export type CalendarQuery = z.output<typeof calendarQuerySchema>;

// ---------------------------------------------------------------------------
// Respuestas
// ---------------------------------------------------------------------------

/** El cliente, resumido, dentro de una renta. */
export interface RentalAgreementCustomer {
  id: string;
  fullName: string;
  documentId: string | null;
  licenseNumber: string | null;
  licenseExpiresAt: string | null;
  birthDate: string | null;
  mobilePhone: string | null;
  phone: string | null;
  isBlocked: boolean;
}

/** El carro, resumido, dentro de una renta y en disponibilidad. */
export interface RentalAgreementVehicle {
  id: string;
  plate: string | null;
  make: string;
  model: string;
  year: number | null;
  color: string | null;
  category: FleetVehicleCategory;
  status: FleetVehicleStatus;
  odometerKm: number;
  dailyRate: string;
  weeklyRate: string | null;
  monthlyRate: string | null;
  freeKmPerDay: number | null;
  extraKmPrice: string | null;
}

export interface RentalAgreementExtension {
  id: string;
  previousReturnAt: string;
  newReturnAt: string;
  addedDays: number;
  note: string | null;
  createdAt: string;
}

/** Una renta, como la devuelve el API. Decimales como cadena; instantes ISO. */
export interface RentalAgreement {
  id: string;
  contractNumber: number | null;
  status: AgreementStatus;
  derivedStatus: AgreementDerivedStatus;
  customerId: string;
  vehicleId: string;
  customer: RentalAgreementCustomer;
  vehicle: RentalAgreementVehicle;
  plannedPickupAt: string;
  plannedReturnAt: string;
  actualPickupAt: string | null;
  actualReturnAt: string | null;
  pickupLocation: string;
  returnLocation: string;
  dailyRate: string;
  billableDays: number;
  cdwPerDay: string;
  deductible: string;
  coverage: RentalCoverage;
  includesVat: boolean;
  extraCharges: string;
  extraChargesNote: string | null;
  discount: string;
  extraKmCharge: string;
  deposit: string;
  depositMethod: PaymentMethod | null;
  depositReturnedAmount: string | null;
  depositReturnedAt: string | null;
  depositReturnNote: string | null;
  /** El depósito pasó a esta renta en un cambio de carro. */
  depositTransferredToId: string | null;
  cardLast4: string | null;
  authorizationCode: string | null;
  authorizationAmount: string | null;
  authorizationDate: string | null;
  additionalDriver: AdditionalDriver | null;
  pickupInspection: RentalInspection | null;
  returnInspection: RentalInspection | null;
  pickupOdometerKm: number | null;
  returnOdometerKm: number | null;
  /** La renta que esta reemplazó en un cambio de carro. */
  previousAgreementId: string | null;
  /** La renta que reemplazó a esta en un cambio de carro. */
  nextAgreementId: string | null;
  swapReason: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  /** `agreementTotals()` ya calculado (RN-10): la UI no suma. */
  totals: AgreementTotals;
  /** Lo que queda del depósito en manos de la rentadora. */
  depositHeld: string;
  /** Con la forma completa de la 098: quién cobró, quién anuló, el carro de la multa. */
  payments: RentalPayment[];
  fines: RentalFine[];
  extensions: RentalAgreementExtension[];
}

/** `POST /rentals/agreements/:id/swap`: la renta cerrada y la nueva. */
export interface AgreementSwapResult {
  closed: RentalAgreement;
  opened: RentalAgreement;
}

/** El resumen de una renta que ocupa un carro, en disponibilidad y calendario. */
export interface AgreementSlot {
  id: string;
  contractNumber: number | null;
  status: AgreementStatus;
  derivedStatus: AgreementDerivedStatus;
  customerName: string;
  plannedPickupAt: string;
  plannedReturnAt: string;
  actualPickupAt: string | null;
  actualReturnAt: string | null;
  /** El tramo que pinta el calendario: salida real o planificada → regreso (real, o ahora si va atrasada). */
  start: string;
  end: string;
}

export const AVAILABILITIES = ['FREE', 'FREE_IF_RETURNED', 'BUSY'] as const;
export type Availability = (typeof AVAILABILITIES)[number];

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  FREE: 'Libre',
  FREE_IF_RETURNED: 'Libre si regresa a tiempo',
  BUSY: 'Ocupado',
};

export interface AvailabilityRow {
  vehicle: RentalAgreementVehicle;
  availability: Availability;
  /** La renta que lo ocupa (o la que tiene que regresar), si hay. */
  blocking: AgreementSlot | null;
  /** Días a cobrar del rango, con la gracia de ajustes. */
  billableDays: number;
  /** `rateForDays()` del carro para esos días. */
  dailyRate: string;
  /** `dailyRate × billableDays`. */
  estimatedTotal: string;
}

export interface CalendarRow {
  vehicle: RentalAgreementVehicle;
  agreements: AgreementSlot[];
}

// ---------------------------------------------------------------------------
// Reglas puras
// ---------------------------------------------------------------------------

function timeOf(value: Date | string): number {
  return (value instanceof Date ? value : new Date(value)).getTime();
}

type StatusFields = { status: AgreementStatus; plannedReturnAt: Date | string };

/** RN-1: `LATE` = en curso con el regreso planificado ya pasado. */
export function derivedStatus(agreement: StatusFields, now: Date): AgreementDerivedStatus {
  if (agreement.status === 'IN_PROGRESS' && timeOf(agreement.plannedReturnAt) < now.getTime()) {
    return 'LATE';
  }
  return agreement.status;
}

export interface Interval {
  start: Date;
  end: Date;
}

type IntervalFields = StatusFields & {
  plannedPickupAt: Date | string;
  actualPickupAt: Date | string | null;
  actualReturnAt?: Date | string | null;
};

/**
 * RN-2: el tramo que ocupa una renta. Arranca en la salida real o la
 * planificada y termina en el regreso planificado; si está en curso y
 * atrasada, hasta `now`. Una finalizada termina en su regreso real.
 */
export function occupiedInterval(agreement: IntervalFields, now: Date): Interval {
  const start = new Date(timeOf(agreement.actualPickupAt ?? agreement.plannedPickupAt));
  const planned = timeOf(agreement.plannedReturnAt);

  if (agreement.status === 'FINISHED' && agreement.actualReturnAt) {
    return { start, end: new Date(timeOf(agreement.actualReturnAt)) };
  }
  if (agreement.status === 'IN_PROGRESS') {
    return { start, end: new Date(Math.max(planned, now.getTime())) };
  }
  return { start, end: new Date(planned) };
}

/**
 * RN-2: dos tramos chocan si se cruzan dejando menos de `bufferMs` entre uno y
 * otro. Terminar a las 10:00 con margen de 1 h deja libre desde las 11:00.
 */
export function intervalsClash(a: Interval, b: Interval, bufferMs: number): boolean {
  return (
    a.start.getTime() < b.end.getTime() + bufferMs && b.start.getTime() < a.end.getTime() + bufferMs
  );
}

/** Horas de margen a milisegundos. */
export function bufferMsOf(bufferHours: number): number {
  return Math.max(0, bufferHours) * HOUR_MS;
}

/**
 * Qué tan libre está un carro en `range` frente a las rentas que lo ocupan
 * (RN-2, RN-5). Una renta en curso no suelta el carro hasta recibirlo: si su
 * regreso planificado más el margen cae antes de `from`, el carro queda «libre
 * si regresa a tiempo»; si no, ocupado.
 */
export function vehicleAvailability<T extends IntervalFields>(
  occupying: readonly T[],
  range: Interval,
  bufferMs: number,
  now: Date,
): { availability: Availability; blocking: T | null } {
  let pendingReturn: T | null = null;

  for (const agreement of occupying) {
    if (!OCCUPYING_STATUSES.includes(agreement.status)) continue;

    const interval = occupiedInterval(agreement, now);

    if (agreement.status === 'IN_PROGRESS') {
      if (interval.start.getTime() >= range.end.getTime() + bufferMs) continue;
      if (timeOf(agreement.plannedReturnAt) + bufferMs <= range.start.getTime()) {
        pendingReturn ??= agreement;
        continue;
      }
      return { availability: 'BUSY', blocking: agreement };
    }

    if (intervalsClash(interval, range, bufferMs)) {
      return { availability: 'BUSY', blocking: agreement };
    }
  }

  return pendingReturn === null
    ? { availability: 'FREE', blocking: null }
    : { availability: 'FREE_IF_RETURNED', blocking: pendingReturn };
}

/** Km permitidos de una renta: `freeKmPerDay × billableDays`; `null` = libres. */
export function allowedKm(freeKmPerDay: number | null, days: number): number | null {
  return freeKmPerDay === null || freeKmPerDay <= 0 ? null : freeKmPerDay * days;
}

/** Los km extra y su cargo al recibir el carro (criterio de checkin). */
export function extraKmOf(input: {
  pickupKm: number | null;
  returnKm: number;
  freeKmPerDay: number | null;
  extraKmPrice: string | null;
  billableDays: number;
}): { driven: number; allowed: number | null; extra: number; charge: string } {
  const driven = Math.max(0, input.returnKm - (input.pickupKm ?? input.returnKm));
  const allowed = allowedKm(input.freeKmPerDay, input.billableDays);
  const extra = allowed === null ? 0 : Math.max(0, driven - allowed);
  const price = input.extraKmPrice === null ? 0 : moneyToCents(input.extraKmPrice);

  return { driven, allowed, extra, charge: centsToMoney(extra * price) };
}

/** Lo que queda del depósito: lo dejado menos lo devuelto; cero si pasó a otra renta. */
export function depositHeldOf(agreement: {
  deposit: string;
  depositReturnedAmount: string | null;
  depositTransferredToId: string | null;
}): string {
  if (agreement.depositTransferredToId !== null) return '0.00';

  const returned =
    agreement.depositReturnedAmount === null ? 0 : moneyToCents(agreement.depositReturnedAmount);

  return centsToMoney(Math.max(0, moneyToCents(agreement.deposit) - returned));
}

// ---------------------------------------------------------------------------
// WhatsApp (RN-9)
// ---------------------------------------------------------------------------

/** Código de país que se antepone a un número local de 8 dígitos. */
export const WHATSAPP_COUNTRY_CODE = '503';

/** `https://wa.me/503XXXXXXXX?text=…`, o `null` si el teléfono no sirve. */
export function waLink(phone: string | null | undefined, text: string): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');

  if (digits.length < 8) return null;

  const number = digits.length === 8 ? `${WHATSAPP_COUNTRY_CODE}${digits}` : digits;

  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

/** La zona del taller: El Salvador no cambia de hora en el año. */
export const RENTAL_TIME_ZONE = 'America/El_Salvador';

const whenFormatter = new Intl.DateTimeFormat('es-SV', {
  timeZone: RENTAL_TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

/** «vie 12 oct, 10:00 a. m.» en la hora del taller. */
export function rentalWhenLabel(value: Date | string): string {
  return whenFormatter
    .format(value instanceof Date ? value : new Date(value))
    .replaceAll(/[\u202f\u00a0]/gu, ' ');
}

/** El texto de la cotización por WhatsApp, desde «¿Qué hay libre?». */
export function quoteText(input: {
  customerName?: string | null;
  vehicleName: string;
  from: Date | string;
  to: Date | string;
  billableDays: number;
  dailyRate: string;
  total: string;
  companyName?: string | null;
}): string {
  const greeting = input.customerName ? `Hola ${input.customerName},` : 'Hola,';
  const days = input.billableDays === 1 ? '1 día' : `${input.billableDays} días`;

  return [
    `${greeting} te cotizamos${input.companyName ? ` en ${input.companyName}` : ''}:`,
    `${input.vehicleName}`,
    `Sale: ${rentalWhenLabel(input.from)}`,
    `Regresa: ${rentalWhenLabel(input.to)}`,
    `${days} × $${input.dailyRate} = $${input.total}`,
    '¿Te lo reservamos?',
  ].join('\n');
}

/** Recordatorio de regreso. */
export function returnReminderText(input: {
  customerName: string;
  vehicleName: string;
  plannedReturnAt: Date | string;
  returnLocation: string;
}): string {
  return [
    `Hola ${input.customerName}, te recordamos que el ${input.vehicleName} se devuelve el ${rentalWhenLabel(input.plannedReturnAt)} en ${input.returnLocation}.`,
    'Si necesitás más días, avisanos para extender la renta.',
  ].join('\n');
}

/** Aviso de atraso. */
export function lateNoticeText(input: {
  customerName: string;
  vehicleName: string;
  plannedReturnAt: Date | string;
}): string {
  return [
    `Hola ${input.customerName}, el ${input.vehicleName} debía regresar el ${rentalWhenLabel(input.plannedReturnAt)}.`,
    'Por favor comunicate con nosotros para coordinar la devolución o la extensión.',
  ].join('\n');
}

/** «Toyota Yaris P53DBC». */
export function agreementVehicleLabel(
  vehicle: Pick<RentalAgreementVehicle, 'make' | 'model' | 'plate'>,
): string {
  return [vehicle.make, vehicle.model, vehicle.plate ?? undefined].filter(Boolean).join(' ');
}
