import { z } from 'zod';

import { civilDateSchema, moneySchema, plateSchema } from '../schemas';

/**
 * spec 095 — La flota de la rentadora: lo que devuelve `/api/fleet/vehicles`.
 *
 * Es otra tabla que los vehículos del lavado (RN-1): el único cruce con el
 * lavado es por la placa, como texto. Un carro se retira, nunca se borra (RN-6).
 */

export const FLEET_VEHICLE_CATEGORIES = [
  'SEDAN',
  'HATCHBACK',
  'SUV',
  'PICKUP',
  'VAN',
  'OTHER',
] as const;
export type FleetVehicleCategory = (typeof FLEET_VEHICLE_CATEGORIES)[number];

export const FLEET_CATEGORY_LABELS: Record<FleetVehicleCategory, string> = {
  SEDAN: 'Sedán',
  HATCHBACK: 'Hatchback',
  SUV: 'Camioneta',
  PICKUP: 'Pick up',
  VAN: 'Microbús',
  OTHER: 'Otro',
};

export const FLEET_VEHICLE_STATUSES = ['ACTIVE', 'IN_SHOP', 'RETIRED'] as const;
export type FleetVehicleStatus = (typeof FLEET_VEHICLE_STATUSES)[number];

export const FLEET_STATUS_LABELS: Record<FleetVehicleStatus, string> = {
  ACTIVE: 'Disponible',
  IN_SHOP: 'En taller',
  RETIRED: 'Retirado',
};

/** Un carro de la flota. Decimales como cadena; fechas civiles `YYYY-MM-DD`. */
export interface FleetVehicle {
  id: string;
  /** Mayúsculas y sin espacios (RN-2). `null`: carro sin placa registrada. */
  plate: string | null;
  make: string;
  model: string;
  year: number | null;
  color: string | null;
  category: FleetVehicleCategory;
  status: FleetVehicleStatus;
  dailyRate: string;
  /** Tarifa por día en rentas de 7 días o más (RN-3). */
  weeklyRate: string | null;
  /** Tarifa por día en rentas de 30 días o más (RN-3). */
  monthlyRate: string | null;
  /** `null` o `0`: kilometraje libre. */
  freeKmPerDay: number | null;
  extraKmPrice: string | null;
  odometerKm: number;
  purchasePrice: string | null;
  purchasedAt: string | null;
  financed: boolean;
  downPayment: string | null;
  installment: string | null;
  termMonths: number | null;
  financingStartedAt: string | null;
  insuranceMonthly: string | null;
  gpsMonthly: string | null;
  otherFixedMonthly: string | null;
  insuranceExpiresAt: string | null;
  registrationExpiresAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { message: `${label} no puede pasar de ${max} caracteres.` })
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

const requiredText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, { message: `Escribí ${label}.` })
    .max(max, { message: `No puede pasar de ${max} caracteres.` });

const wholeNumber = (min: number, max: number) =>
  z
    .number({ message: 'Escribí un número.' })
    .int({ message: 'Tiene que ser un número entero.' })
    .min(min, { message: `No puede ser menor que ${min}.` })
    .max(max, { message: `No puede pasar de ${max}.` });

const optionalMoney = moneySchema.nullable().optional();
const optionalDate = civilDateSchema.nullable().optional();

/** Placa opcional (RN-2): vacía viaja como `null`, que es «sin placa». */
const optionalPlate = z
  .union([z.literal(''), plateSchema])
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

/** Los campos que se editan; los mismos en el alta y en la edición. */
const fleetVehicleShape = {
  plate: optionalPlate,
  make: requiredText(40, 'la marca'),
  model: requiredText(60, 'el modelo'),
  year: wholeNumber(1950, 2100).nullable().optional(),
  color: optionalText(30, 'El color'),
  category: z.enum(FLEET_VEHICLE_CATEGORIES, { message: 'Elegí el tipo de carro.' }),
  dailyRate: moneySchema,
  weeklyRate: optionalMoney,
  monthlyRate: optionalMoney,
  freeKmPerDay: wholeNumber(0, 10_000).nullable().optional(),
  extraKmPrice: optionalMoney,
  odometerKm: wholeNumber(0, 2_000_000),
  purchasePrice: optionalMoney,
  purchasedAt: optionalDate,
  financed: z.boolean(),
  downPayment: optionalMoney,
  installment: optionalMoney,
  termMonths: wholeNumber(1, 120).nullable().optional(),
  financingStartedAt: optionalDate,
  insuranceMonthly: optionalMoney,
  gpsMonthly: optionalMoney,
  otherFixedMonthly: optionalMoney,
  insuranceExpiresAt: optionalDate,
  registrationExpiresAt: optionalDate,
  notes: optionalText(1000, 'La nota'),
};

/** `POST /fleet/vehicles`: nace `ACTIVE`. Solo marca, modelo y tarifa diaria son obligatorios. */
export const createFleetVehicleSchema = z.object({
  ...fleetVehicleShape,
  category: fleetVehicleShape.category.default('SEDAN'),
  odometerKm: fleetVehicleShape.odometerKm.default(0),
  financed: fleetVehicleShape.financed.default(false),
});
export type CreateFleetVehicleInput = z.infer<typeof createFleetVehicleSchema>;

/**
 * `PATCH /fleet/vehicles/:id`. Lo que no viene no se toca; un `null` borra el
 * dato. Incluye `status`: a taller, de vuelta o retirado (RN-6).
 */
export const updateFleetVehicleSchema = z
  .object({
    ...fleetVehicleShape,
    status: z.enum(FLEET_VEHICLE_STATUSES, { message: 'Elegí el estado.' }),
  })
  .partial();
export type UpdateFleetVehicleInput = z.infer<typeof updateFleetVehicleSchema>;

/** `GET /fleet/vehicles?status&q`. `q` busca en placa, marca, modelo y color. */
export const fleetVehiclesQuerySchema = z.object({
  status: z.enum(FLEET_VEHICLE_STATUSES, { message: 'Ese estado no existe.' }).optional(),
  q: z.string().trim().max(60).optional(),
});
export type FleetVehiclesQuery = z.infer<typeof fleetVehiclesQuerySchema>;

/** «Toyota Yaris 2022». */
export function fleetVehicleName(vehicle: Pick<FleetVehicle, 'make' | 'model' | 'year'>): string {
  return [vehicle.make, vehicle.model, vehicle.year ?? undefined].filter(Boolean).join(' ');
}
