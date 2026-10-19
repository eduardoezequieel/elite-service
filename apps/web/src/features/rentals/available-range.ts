import { addDays, parseCivil, type CivilDate, type CivilRange } from '@/lib/civil-date';
import { civilAtTime, fieldToInstant } from './datetime';

/**
 * Rangos de Libre (107). Desde la 117 el rango se elige solo en el
 * calendario, sin atajos.
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

const shortDay = new Intl.DateTimeFormat('es-SV', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

/** «vie 16 oct»: el día de un campo o de un día civil. */
export function dayShort(field: string): string {
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
