import { PAYMENT_METHODS, waLink } from '@elite/shared';
import type {
  AgreementSlot,
  PaymentMethod,
  Availability,
  RentalAgreementCustomer,
  RentalAgreementVehicle,
} from '@elite/shared';

import type { StampTone } from '@/components/ui/stamp';
import { addDays, type CivilDate } from '@/lib/civil-date';
import { instantToCivil } from './datetime';

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
