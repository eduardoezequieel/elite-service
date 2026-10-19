import { addDays, isCivil, parseCivil, type CivilDate, type CivilRange } from '@/lib/civil-date';
import { addDaysToField, civilAtTime, civilStartInstant, fieldToInstant } from './datetime';

/**
 * Rangos de Libre (107). Los atajos son los de la spec, no los del prototipo:
 * «Mañana», «Fin de semana» y «Una semana».
 */

export interface FreeRange {
  /** Valor de `datetime-local` en la hora del taller: `YYYY-MM-DDTHH:mm`. */
  from: string;
  to: string;
}

const AT = '09:00';

/** Mañana 09:00 → pasado mañana 09:00. También es el rango de arranque. */
export function defaultFreeRange(today: CivilDate): FreeRange {
  const tomorrow = addDays(today, 1);

  return { from: civilAtTime(tomorrow, AT), to: civilAtTime(addDays(tomorrow, 1), AT) };
}

/** Mañana 09:00 → dentro de siete días, 09:00. */
export function weekRange(today: CivilDate): FreeRange {
  const tomorrow = addDays(today, 1);

  return { from: civilAtTime(tomorrow, AT), to: civilAtTime(addDays(tomorrow, 7), AT) };
}

/**
 * Sábado 09:00 → lunes 09:00. Si hoy es sábado, ese sábado; si es domingo, el
 * sábado que acaba de pasar; si no, el sábado que viene.
 */
export function weekendRange(today: CivilDate): FreeRange {
  const weekday = parseCivil(today).getUTCDay();
  const delta = weekday === 6 ? 0 : weekday === 0 ? -1 : 6 - weekday;
  const saturday = addDays(today, delta);

  return { from: civilAtTime(saturday, AT), to: civilAtTime(addDays(saturday, 2), AT) };
}

/** Si Sale no queda antes de Regresa, Regresa pasa al día siguiente a las 09:00. */
export function pushReturn(from: string, to: string): string {
  const fromAt = fieldToInstant(from);
  const toAt = fieldToInstant(to);
  if (fromAt === null || toAt === null || Date.parse(fromAt) < Date.parse(toAt)) return to;

  return addDaysToField(civilAtTime(from.slice(0, 10), AT), 1);
}

/** Los siete días civiles desde Sale, o ninguno si la fecha no es un día. */
export function weekDays(fromField: string): CivilDate[] {
  const start = fromField.slice(0, 10);
  if (!isCivil(start)) return [];

  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

/** Quién ocupa el día. El enlace abre la primera renta; los nombres van con « · ». */
export function dayOccupancy(
  agreements: readonly { id: string; start: string; end: string; customerName: string }[],
  day: CivilDate,
): { agreementId: string; label: string } | null {
  const start = Date.parse(civilStartInstant(day));
  const end = Date.parse(civilStartInstant(addDays(day, 1)));
  const hits = agreements.filter(
    (agreement) => Date.parse(agreement.start) < end && Date.parse(agreement.end) > start,
  );
  const first = hits[0];
  if (first === undefined) return null;

  return {
    agreementId: first.id,
    label: hits
      .map((agreement) => agreement.customerName.trim().split(/\s+/)[0] ?? '')
      .filter((name) => name !== '')
      .join(' · '),
  };
}

const shortDay = new Intl.DateTimeFormat('es-SV', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

function dayShort(field: string): string {
  return shortDay.format(parseCivil(field.slice(0, 10))).replace(/[.,]/g, '');
}

/**
 * El rango en el disparador del calendario: «vie 16 oct → sáb 17 oct · 1 día».
 * Los días se cuentan como la tarifa: cada 24 h empezadas.
 */
export function rangeLabel(range: FreeRange): string {
  const fromAt = fieldToInstant(range.from);
  const toAt = fieldToInstant(range.to);
  const hours = fromAt === null || toAt === null ? 0 : Date.parse(toAt) - Date.parse(fromAt);
  const days = Math.max(1, Math.ceil(hours / 86_400_000));

  return `${dayShort(range.from)} → ${dayShort(range.to)} · ${days} ${days === 1 ? 'día' : 'días'}`;
}

/** Los días del rango, para el calendario. */
export function toCivilRange(range: FreeRange): CivilRange {
  return { from: range.from.slice(0, 10), to: range.to.slice(0, 10) };
}

/** Lo elegido en el calendario, a las 09:00. Un solo día es salir y volver al siguiente. */
export function fromCivilRange(range: CivilRange): FreeRange {
  const to = range.to > range.from ? range.to : addDays(range.from, 1);

  return { from: civilAtTime(range.from, AT), to: civilAtTime(to, AT) };
}
