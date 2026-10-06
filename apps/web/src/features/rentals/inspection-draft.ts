import { checkinSchema, checkoutSchema, extraKmOf } from '@elite/shared';
import type {
  CheckinInput,
  CheckoutInput,
  InspectionDamage,
  InspectionZone,
  PaymentMethod,
  RentalInspection,
} from '@elite/shared';

import { fieldToInstant } from './datetime';
import { moneyOrNull, textOrNull, wholeOrNull } from './form-draft';

/**
 * El borrador de la entrega y la recepción (096): lo que se va llenando paso
 * a paso en el celular, y cómo se vuelve el cuerpo del pedido. Puro.
 */

export const INSPECTION_STEPS = [
  { key: 'km', label: 'Kilometraje' },
  { key: 'damages', label: 'Golpes' },
  { key: 'charge', label: 'Cobro' },
] as const;
export type InspectionStep = (typeof INSPECTION_STEPS)[number]['key'];

export type InspectionMode = 'checkout' | 'checkin';

export interface InspectionDraft {
  /** `datetime-local` en la hora del taller. */
  at: string;
  odometerKm: string;
  fuelEighths: number | null;
  damages: InspectionDamage[];
  accessories: Record<string, boolean>;
  tiresFront: string;
  tiresRear: string;
  battery: string;
  photoIds: string[];
  notes: string;
  /** Entrega: el depósito que deja el cliente. */
  deposit: string;
  depositMethod: PaymentMethod | '';
  /** Pago opcional, en la entrega o en la recepción. */
  paymentAmount: string;
  paymentMethod: PaymentMethod;
  paymentReference: string;
  /** Recepción: los días a cobrar (sobreescribe el cálculo si cambia) y su nota. */
  billableDays: string;
  billableDaysNote: string;
  chargeExtraKm: boolean;
  depositReturnAmount: string;
  depositReturnMethod: PaymentMethod | '';
  depositReturnNote: string;
  agreementNotes: string;
}

/** Lo que el asistente necesita saber de la renta (o de la reserva a medio armar). */
export interface InspectionContext {
  vehicleOdometerKm: number;
  pickupInspection: RentalInspection | null;
  pickupOdometerKm: number | null;
  deposit: string;
  depositMethod: PaymentMethod | null;
  depositHeld: string;
}

/** Arranque: todos los accesorios presentes; en la recepción, los daños de la salida. */
export function initialDraft(
  mode: InspectionMode,
  context: InspectionContext,
  accessories: readonly string[],
  at: string,
): InspectionDraft {
  const pickup = context.pickupInspection;
  const pickupAccessories = pickup?.accessories ?? {};
  const keptAccessories =
    mode === 'checkin' && Object.keys(pickupAccessories).length > 0
      ? { ...pickupAccessories }
      : Object.fromEntries(accessories.map((name) => [name, true]));

  return {
    at,
    odometerKm:
      mode === 'checkin'
        ? ''
        : String(context.vehicleOdometerKm > 0 ? context.vehicleOdometerKm : ''),
    fuelEighths: null,
    damages: mode === 'checkin' && pickup !== null ? pickup.damages.map((d) => ({ ...d })) : [],
    accessories: keptAccessories,
    tiresFront: '',
    tiresRear: '',
    battery: '',
    photoIds: [],
    notes: '',
    deposit: context.deposit === '0.00' ? '' : context.deposit,
    depositMethod: context.depositMethod ?? '',
    paymentAmount: '',
    paymentMethod: 'CASH',
    paymentReference: '',
    billableDays: '',
    billableDaysNote: '',
    chargeExtraKm: true,
    depositReturnAmount:
      mode === 'checkin' && context.depositHeld !== '0.00' ? context.depositHeld : '',
    depositReturnMethod: context.depositMethod ?? '',
    depositReturnNote: '',
    agreementNotes: '',
  };
}

/** Marca o desmarca una zona: la lista de daños tiene una entrada por zona. */
export function toggleZone(damages: readonly InspectionDamage[], zone: InspectionZone) {
  return damages.some((damage) => damage.zone === zone)
    ? damages.filter((damage) => damage.zone !== zone)
    : [...damages, { zone, description: '' }];
}

/** El km escrito, o `null` si no es un entero. */
export function odometerOf(draft: Pick<InspectionDraft, 'odometerKm'>): number | null {
  const value = wholeOrNull(draft.odometerKm);
  return typeof value === 'number' ? value : null;
}

/** Lo que falta para pasar de paso, o `null`. En kilometraje: hora, km y combustible (RN-8). */
export function stepError(
  step: InspectionStep,
  mode: InspectionMode,
  draft: InspectionDraft,
  context: InspectionContext,
): string | null {
  if (step === 'km') {
    if (fieldToInstant(draft.at) === null) return 'Elegí la hora.';
    const km = odometerOf(draft);
    if (km === null) return 'Escribí el kilometraje del tablero.';
    if (mode === 'checkin' && context.pickupOdometerKm !== null && km < context.pickupOdometerKm) {
      return `El kilometraje no puede ser menor que el de salida (${context.pickupOdometerKm} km).`;
    }
    if (draft.fuelEighths === null) return 'Marcá cuánto combustible tiene.';
  }
  return null;
}

/** La inspección del borrador, en la forma del contrato (RN-7). */
export function inspectionOf(draft: InspectionDraft) {
  return {
    odometerKm: odometerOf(draft) ?? -1,
    fuelEighths: draft.fuelEighths ?? -1,
    damages: draft.damages,
    accessories: draft.accessories,
    tires: { front: textOrNull(draft.tiresFront), rear: textOrNull(draft.tiresRear) },
    battery: textOrNull(draft.battery),
    photoIds: draft.photoIds,
    notes: textOrNull(draft.notes),
  };
}

type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? 'Revisá los datos.';
}

/** El cuerpo de la entrega, validado con el schema del contrato. */
export function checkoutBody(draft: InspectionDraft): Parsed<CheckoutInput> {
  const parsed = checkoutSchema.safeParse({
    actualPickupAt: fieldToInstant(draft.at) ?? '',
    inspection: inspectionOf(draft),
    deposit: moneyOrNull(draft.deposit) ?? '0',
    depositMethod: draft.depositMethod === '' ? null : draft.depositMethod,
  });

  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, message: firstIssue(parsed.error) };
}

/**
 * El cuerpo de la recepción. Los días viajan solo si se cambió el cálculo
 * (RN-4); la devolución del depósito, solo si se escribió un monto.
 */
export function checkinBody(draft: InspectionDraft, computedDays: number): Parsed<CheckinInput> {
  const typedDays = wholeOrNull(draft.billableDays);
  const overrides = typeof typedDays === 'number' && typedDays !== computedDays;
  const depositAmount = moneyOrNull(draft.depositReturnAmount);

  if (overrides && textOrNull(draft.billableDaysNote) === null) {
    return { ok: false, message: 'Si cambiás los días, escribí por qué.' };
  }

  const parsed = checkinSchema.safeParse({
    actualReturnAt: fieldToInstant(draft.at) ?? '',
    inspection: inspectionOf(draft),
    ...(overrides ? { billableDays: typedDays, billableDaysNote: draft.billableDaysNote } : {}),
    chargeExtraKm: draft.chargeExtraKm,
    depositReturn:
      depositAmount === null
        ? undefined
        : {
            amount: depositAmount,
            method: draft.depositReturnMethod === '' ? null : draft.depositReturnMethod,
            note: textOrNull(draft.depositReturnNote),
          },
    notes: textOrNull(draft.agreementNotes),
  });

  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, message: firstIssue(parsed.error) };
}

/** Los km extra que se van a cobrar, para mostrarlos antes de recibir. */
export function checkinExtraKm(
  draft: InspectionDraft,
  context: InspectionContext,
  vehicle: { freeKmPerDay: number | null; extraKmPrice: string | null },
  days: number,
) {
  const km = odometerOf(draft);
  if (km === null) return null;

  const result = extraKmOf({
    pickupKm: context.pickupOdometerKm,
    returnKm: km,
    freeKmPerDay: vehicle.freeKmPerDay,
    extraKmPrice: vehicle.extraKmPrice,
    billableDays: days,
  });

  return draft.chargeExtraKm ? result : { ...result, charge: '0.00' };
}

/** `sessionStorage` o un mapa en los tests. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Una entrega a medias, por renta y modo. */
export function inspectionDraftKey(agreementId: string, mode: InspectionMode): string {
  return `elite.rental-handover.${agreementId}.${mode}`;
}

/** El borrador guardado, o `null` si no hay o el JSON no sirve. */
export function readInspectionDraft(store: KeyValueStore, key: string): InspectionDraft | null {
  let raw: string | null;

  try {
    raw = store.getItem(key);
  } catch {
    return null;
  }
  if (raw === null || raw === '') return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    if (!('at' in value) || typeof value.at !== 'string') return null;
    if (!('odometerKm' in value) || typeof value.odometerKm !== 'string') return null;

    return value as InspectionDraft;
  } catch {
    return null;
  }
}

export function writeInspectionDraft(
  store: KeyValueStore,
  key: string,
  draft: InspectionDraft,
): void {
  try {
    store.setItem(key, JSON.stringify(draft));
  } catch {
    // Modo privado o cuota llena: el asistente sigue sin borrador.
  }
}

export function clearInspectionDraft(store: KeyValueStore, key: string): void {
  try {
    store.removeItem(key);
  } catch {
    // Igual que al guardar: si el almacén no responde, no hay nada que borrar.
  }
}
