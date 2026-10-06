import { PAYMENT_METHODS, centsToMoney, moneyToCents, waLink } from '@elite/shared';
import type {
  AgreementSlot,
  AgreementStatus,
  PaymentMethod,
  Availability,
  RentalAgreement,
  RentalAgreementCustomer,
  RentalAgreementVehicle,
} from '@elite/shared';

import type { StampTone } from '@/components/ui/stamp';
import { depositStatus } from '@/features/rental-billing/billing-format';
import { addDays, type CivilDate } from '@/lib/civil-date';
import { formatMoneyCompact } from '@/lib/money';

import { instantToCivil, instantToField } from './datetime';

/** Lo que se lee y se arma en las pantallas de rentas (096). Puro. */

/** «Toyota Yaris 2022». */
export function vehicleTitle(vehicle: Pick<RentalAgreementVehicle, 'make' | 'model' | 'year'>) {
  return [vehicle.make, vehicle.model, vehicle.year ?? undefined].filter(Boolean).join(' ');
}

/** El teléfono para WhatsApp: el celular primero. */
export function customerPhone(customer: Pick<RentalAgreementCustomer, 'mobilePhone' | 'phone'>) {
  return customer.mobilePhone ?? customer.phone ?? null;
}

/**
 * El enlace de WhatsApp (RN-9). Sin teléfono que sirva, `wa.me` sin número:
 * WhatsApp abre el texto y deja elegir a quién mandarlo.
 */
export function whatsappHref(phone: string | null | undefined, text: string): string {
  return waLink(phone, text) ?? `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** El tono del sello de disponibilidad: libre en verde, «si regresa» en ámbar, ocupado en rojo. */
export const AVAILABILITY_TONES: Record<Availability, StampTone> = {
  FREE: 'green',
  FREE_IF_RETURNED: 'amber',
  BUSY: 'red',
};

/** Los días de un rango del calendario, empezando en `from`. */
export function calendarDays(from: CivilDate, count: number): CivilDate[] {
  return Array.from({ length: count }, (_, index) => addDays(from, index));
}

/**
 * Dónde cae la barra de una renta entre los días visibles: desde qué columna
 * y cuántas ocupa. `null` si no toca el rango. Las puntas que siguen afuera se
 * marcan para dibujarlas sin redondear.
 */
export function slotPlacement(
  slot: Pick<AgreementSlot, 'start' | 'end'>,
  days: readonly CivilDate[],
): { index: number; span: number; continuesBefore: boolean; continuesAfter: boolean } | null {
  const first = days[0];
  const last = days[days.length - 1];
  if (first === undefined || last === undefined) return null;

  const start = instantToCivil(slot.start);
  const end = instantToCivil(slot.end);
  if (end < first || start > last) return null;

  const from = start < first ? first : start;
  const to = end > last ? last : end;
  const index = days.indexOf(from);
  const until = days.indexOf(to);

  if (index < 0 || until < 0) return null;

  return {
    index,
    span: until - index + 1,
    continuesBefore: start < first,
    continuesAfter: end > last,
  };
}

/** Los métodos de pago de la rentadora, en el orden del cobro. */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
};

export const PAYMENT_METHOD_OPTIONS = PAYMENT_METHODS.map((method) => ({
  value: method,
  label: PAYMENT_METHOD_LABELS[method],
}));

/** Un monto con signo para el saldo: negativo es «a favor». */
export function isNegativeAmount(amount: string): boolean {
  return amount.trim().startsWith('-');
}

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'] as const;

/** «jue 8, 9:00» en la hora del taller, sin mes ni a. m. */
function spokenWhen(iso: string): string {
  const field = instantToField(iso);
  if (field === '') return '—';

  const date = field.slice(0, 10);
  const time = field.slice(11);
  const day = Number(date.slice(8, 10));
  const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()] ?? '';
  const [hour = '0', minutes = '00'] = time.split(':');

  return `${weekday} ${day}, ${Number(hour)}:${minutes}`;
}

/** «sale jue 8, 9:00 → vuelve lun 12, 9:00». Lo real si ya pasó; si no, lo planificado. */
export function saleReturnPhrase(pickupIso: string, returnIso: string): string {
  return `sale ${spokenWhen(pickupIso)} → vuelve ${spokenWhen(returnIso)}`;
}

/** El filtro de la lista (108). Falta o no se reconoce: «En la calle». */
export type AgreementListFilter = AgreementStatus | 'ALL';

export function agreementListFilter(status: string | null | undefined): AgreementListFilter {
  if (
    status === 'RESERVED' ||
    status === 'IN_PROGRESS' ||
    status === 'FINISHED' ||
    status === 'CANCELLED' ||
    status === 'ALL'
  ) {
    return status;
  }

  return 'IN_PROGRESS';
}

/**
 * Lo que viaja al API. «Todas» no manda estado. «En la calle» es
 * `IN_PROGRESS`: `LATE` se deriva y no se pide con `late=true`.
 */
export function agreementListQuery(
  filter: AgreementListFilter,
): { status?: AgreementStatus[] } {
  if (filter === 'ALL') return {};

  return { status: [filter] };
}

export interface AccountLine {
  key: string;
  label: string;
  /** Monto positivo, como lo manda el API. */
  amount: string;
  minus?: boolean;
}

type AccountSource = Pick<
  RentalAgreement,
  | 'dailyRate'
  | 'cdwPerDay'
  | 'billableDays'
  | 'extraCharges'
  | 'extraChargesNote'
  | 'extraKmCharge'
  | 'discount'
  | 'fines'
>;

/**
 * Los renglones de la cuenta (108). Días y seguro se parten para leerse
 * aparte, aunque `totals.rental` los sume. Cargos y km extra aparecen solo
 * si suman, para que los renglones cierren con el total.
 */
export function accountLines(agreement: AccountSource): AccountLine[] {
  const days = agreement.billableDays;
  const lines: AccountLine[] = [
    {
      key: 'days',
      label: `${days} ${days === 1 ? 'día' : 'días'} × ${formatMoneyCompact(agreement.dailyRate)}`,
      amount: centsToMoney(moneyToCents(agreement.dailyRate) * days),
    },
  ];
  const cdw = moneyToCents(agreement.cdwPerDay);

  if (cdw > 0) {
    lines.push({
      key: 'insurance',
      label: 'Seguro',
      amount: centsToMoney(cdw * days),
    });
  }

  const fines = agreement.fines
    .filter((fine) => fine.chargedToCustomer)
    .reduce((sum, fine) => sum + moneyToCents(fine.amount), 0);

  if (fines > 0) lines.push({ key: 'fines', label: 'Multas', amount: centsToMoney(fines) });
  if (moneyToCents(agreement.extraCharges) > 0) {
    lines.push({
      key: 'extras',
      label: agreement.extraChargesNote ?? 'Cargos',
      amount: agreement.extraCharges,
    });
  }
  if (moneyToCents(agreement.extraKmCharge) > 0) {
    lines.push({ key: 'km', label: 'Km extra', amount: agreement.extraKmCharge });
  }
  if (moneyToCents(agreement.discount) > 0) {
    lines.push({ key: 'discount', label: 'Descuento', amount: agreement.discount, minus: true });
  }

  return lines;
}

const GUARANTEE_METHOD: Record<PaymentMethod, string> = {
  CASH: 'efectivo',
  CARD: 'tarjeta',
  TRANSFER: 'transferencia',
  OTHER: 'otro',
};

/**
 * La garantía en una línea (108): «Garantía $100 en efectivo», «Devuelta $80»
 * o «Sin garantía». Si pasó a otra renta: «Garantía $100 en otra renta».
 */
export function guaranteeLine(
  agreement: Pick<
    RentalAgreement,
    'deposit' | 'depositMethod' | 'depositReturnedAmount' | 'depositTransferredToId'
  >,
): string {
  const status = depositStatus(agreement);

  if (status.kind === 'none') return 'Sin garantía';
  if (status.kind === 'returned') return `Devuelta ${formatMoneyCompact(status.returned)}`;
  if (status.kind === 'transferred') {
    return `Garantía ${formatMoneyCompact(status.amount)} en otra renta`;
  }

  const method =
    agreement.depositMethod === null ? '' : ` en ${GUARANTEE_METHOD[agreement.depositMethod]}`;

  return `Garantía ${formatMoneyCompact(status.amount)}${method}`;
}
