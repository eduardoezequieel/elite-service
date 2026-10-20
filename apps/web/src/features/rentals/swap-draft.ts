import {
  agreementTotals,
  billableDays,
  centsToMoney,
  moneyToCents,
  rateForDays,
  swapSchema,
} from '@elite/shared';
import type { RentalAgreement, RentalAgreementVehicle, SwapInput } from '@elite/shared';

import { fieldToInstant } from './datetime';
import { moneyOrNull } from './form-draft';
import {
  checkinExtraKm,
  checkinPreview,
  damageLinesBody,
  initialDraft,
  inspectionOf,
  odometerOf,
  type InspectionContext,
  type InspectionDraft,
} from './inspection-draft';

/**
 * Cambiar de carro (127 RN-5), puro: Recibir el actual → Entregar el nuevo →
 * Listo. Cada mitad es un borrador de la inspección de siempre (096, 126);
 * acá se arman las fechas, la tarifa (RN-6), el resumen de las dos rentas con
 * el excedente que pasa a la nueva y el cuerpo de `POST …/swap`.
 */

export const SWAP_STEPS = [
  { key: 'return', label: 'Recibir' },
  { key: 'pickup', label: 'Entregar' },
  { key: 'done', label: 'Listo' },
] as const;
export type SwapStep = (typeof SWAP_STEPS)[number]['key'];

/** Por qué se cambia: un toque y, si hace falta, el detalle. */
export const SWAP_REASONS = ['Falla', 'Choque', 'Extendió', 'Pidió otro'] as const;
export type SwapReason = (typeof SWAP_REASONS)[number];

/** RN-6: la misma (por defecto), la del carro por tramo u otra escrita. */
export type SwapRateMode = 'same' | 'vehicle' | 'other';

export interface SwapDraft {
  /** El carro que entra; su `at` es el instante del cambio. */
  returned: InspectionDraft;
  why: SwapReason | '';
  detail: string;
  /** El carro que sale, elegido de los libres. */
  vehicle: RentalAgreementVehicle | null;
  pickup: InspectionDraft;
  rateMode: SwapRateMode;
  otherRate: string;
}

/** Lo que el cambio necesita de la renta. */
export type SwapSource = Pick<
  RentalAgreement,
  | 'contractNumber'
  | 'vehicleId'
  | 'vehicle'
  | 'plannedPickupAt'
  | 'actualPickupAt'
  | 'plannedReturnAt'
  | 'pickupInspection'
  | 'pickupOdometerKm'
  | 'deposit'
  | 'depositMethod'
  | 'depositHeld'
  | 'dailyRate'
  | 'cdwPerDay'
  | 'extraCharges'
  | 'extraChargesNote'
  | 'discount'
  | 'fines'
  | 'payments'
  | 'coverage'
  | 'deductible'
>;

export function swapContext(agreement: SwapSource): InspectionContext {
  return {
    vehicleOdometerKm: agreement.vehicle.odometerKm,
    pickupInspection: agreement.pickupInspection,
    pickupOdometerKm: agreement.pickupOdometerKm,
    deposit: agreement.deposit,
    depositMethod: agreement.depositMethod,
    depositHeld: agreement.depositHeld,
  };
}

export function initialSwapDraft(
  agreement: SwapSource,
  accessories: readonly string[],
  at: string,
): SwapDraft {
  return {
    returned: initialDraft('checkin', swapContext(agreement), accessories, at),
    why: '',
    detail: '',
    vehicle: null,
    pickup: pickupDraftFor(null, accessories, at),
    rateMode: 'same',
    otherRate: '',
  };
}

function pickupDraftFor(
  vehicle: RentalAgreementVehicle | null,
  accessories: readonly string[],
  at: string,
): InspectionDraft {
  return initialDraft(
    'checkout',
    {
      vehicleOdometerKm: vehicle?.odometerKm ?? 0,
      pickupInspection: null,
      pickupOdometerKm: null,
      deposit: '0.00',
      depositMethod: null,
      depositHeld: '0.00',
    },
    accessories,
    at,
  );
}

/** Elegir el carro nuevo: el km arranca en el del carro y los golpes, vacíos. */
export function pickSwapVehicle(
  draft: SwapDraft,
  vehicle: RentalAgreementVehicle | null,
  accessories: readonly string[],
): SwapDraft {
  if (vehicle?.id === draft.vehicle?.id) return draft;

  return { ...draft, vehicle, pickup: pickupDraftFor(vehicle, accessories, draft.returned.at) };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SwapWindow {
  /** El instante del cambio, o `null` si la fecha no sirve. */
  at: string | null;
  /** El regreso de la renta nueva: el planificado o, si ya iba atrasada, un día después. */
  until: string | null;
  closedDays: number;
  openedDays: number;
}

/** Las fechas del cambio, con la misma cuenta que el API. */
export function swapWindow(agreement: SwapSource, at: string, graceHours: number): SwapWindow {
  const instant = fieldToInstant(at);
  const pickup = agreement.actualPickupAt ?? agreement.plannedPickupAt;

  if (instant === null) return { at: null, until: null, closedDays: 1, openedDays: 1 };

  const time = new Date(instant).getTime();
  const planned = new Date(agreement.plannedReturnAt).getTime();
  const until = planned > time ? agreement.plannedReturnAt : new Date(time + DAY_MS).toISOString();

  return {
    at: instant,
    until,
    closedDays: billableDays(pickup, instant, graceHours),
    openedDays: billableDays(instant, until, graceHours),
  };
}

function positiveMoney(value: string): string | null {
  const amount = moneyOrNull(value);
  if (amount === null) return null;
  try {
    const cents = moneyToCents(amount);
    return cents > 0 ? centsToMoney(cents) : null;
  } catch {
    return null;
  }
}

/** La tarifa por día del carro nuevo (RN-6), o `null` si «Otra» no se lee. */
export function swapRate(
  draft: Pick<SwapDraft, 'rateMode' | 'otherRate' | 'vehicle'>,
  agreement: Pick<SwapSource, 'dailyRate'>,
  openedDays: number,
): string | null {
  if (draft.rateMode === 'other') return positiveMoney(draft.otherRate);
  if (draft.rateMode === 'vehicle' && draft.vehicle !== null) {
    return rateForDays(draft.vehicle, openedDays);
  }
  return agreement.dailyRate;
}

/** «Falla · frenos»: el toque y el detalle, en el motivo que guarda la renta. */
export function swapReasonText(draft: Pick<SwapDraft, 'why' | 'detail'>): string {
  return [draft.why, draft.detail.trim()].filter((part) => part !== '').join(' · ');
}

/** Lo que falta para pasar de paso, o `null`. */
export function swapStepError(
  step: SwapStep,
  draft: SwapDraft,
  agreement: SwapSource,
  graceHours: number,
): string | null {
  if (step === 'return') {
    const window = swapWindow(agreement, draft.returned.at, graceHours);
    const pickup = agreement.actualPickupAt ?? agreement.plannedPickupAt;
    if (window.at === null) return 'Elija la fecha y la hora.';
    if (new Date(window.at).getTime() <= new Date(pickup).getTime()) {
      return 'El cambio tiene que ser después de la salida.';
    }
    const km = odometerOf(draft.returned);
    if (km === null) return 'Escriba el kilometraje del tablero.';
    if (agreement.pickupOdometerKm !== null && km < agreement.pickupOdometerKm) {
      return `El kilometraje no puede ser menor que el de salida (${agreement.pickupOdometerKm} km).`;
    }
    if (draft.returned.fuelEighths === null) return 'Marque cuánto combustible tiene.';
    if (swapReasonText(draft) === '') return 'Diga por qué se cambia.';
  }
  if (step === 'pickup') {
    if (draft.vehicle === null) return 'Elija el carro nuevo.';
    if (odometerOf(draft.pickup) === null) return 'Escriba el kilometraje del carro nuevo.';
    if (draft.pickup.fuelEighths === null) return 'Marque cuánto combustible lleva.';
    const window = swapWindow(agreement, draft.returned.at, graceHours);
    if (swapRate(draft, agreement, window.openedDays) === null) return 'Escriba la tarifa por día.';
  }
  return null;
}

/**
 * Las dos rentas del resumen (Listo), con la cuenta del API: la vieja con los
 * cargos de la recepción (126) y la nueva por los días que faltan. Lo pagado
 * de más en la vieja pasa a la nueva (opción A del dueño).
 */
export function swapPreview(agreement: SwapSource, draft: SwapDraft, graceHours: number) {
  const window = swapWindow(agreement, draft.returned.at, graceHours);
  const extra = checkinExtraKm(
    draft.returned,
    swapContext(agreement),
    agreement.vehicle,
    window.closedDays,
  );
  const closed = checkinPreview(
    agreement,
    draft.returned,
    window.closedDays,
    extra?.charge ?? '0.00',
  );
  const surplusCents = Math.max(0, -moneyToCents(closed.totals.balance));
  const rate = swapRate(draft, agreement, window.openedDays) ?? agreement.dailyRate;
  const opened = agreementTotals({
    dailyRate: rate,
    cdwPerDay: agreement.cdwPerDay,
    billableDays: window.openedDays,
    extraCharges: '0.00',
    extraKmCharge: '0.00',
    fuelCharge: '0.00',
    damageCharge: '0.00',
    finesCharged: '0.00',
    discount: '0.00',
    payments: surplusCents > 0 ? [{ amount: centsToMoney(surplusCents) }] : [],
  });

  return {
    window,
    rate,
    surplus: centsToMoney(surplusCents),
    closed: {
      ...closed,
      totals: {
        ...closed.totals,
        paid: centsToMoney(moneyToCents(closed.totals.paid) - surplusCents),
        balance: centsToMoney(moneyToCents(closed.totals.balance) + surplusCents),
      },
    },
    opened,
  };
}

type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

/** El cuerpo de `POST …/swap`. La tarifa viaja siempre (RN-6). */
export function swapBody(
  draft: SwapDraft,
  agreement: SwapSource,
  graceHours: number,
): Parsed<SwapInput> {
  const window = swapWindow(agreement, draft.returned.at, graceHours);
  const parsed = swapSchema.safeParse({
    at: window.at ?? '',
    newVehicleId: draft.vehicle?.id ?? '',
    dailyRate: swapRate(draft, agreement, window.openedDays) ?? '',
    reason: swapReasonText(draft),
    returnInspection: inspectionOf(draft.returned),
    chargeExtraKm: draft.returned.chargeExtraKm,
    fuelCharge: moneyOrNull(draft.returned.fuelAmount) ?? '0',
    damageLines: damageLinesBody(draft.returned.damageLines),
    pickupInspection: inspectionOf(draft.pickup),
  });

  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, message: parsed.error.issues[0]?.message ?? 'Revise los datos.' };
}
