/**
 * Fechas civiles `YYYY-MM-DD` en la zona del taller.
 *
 * Nada de `Date` local: un `new Date('2026-09-05')` se corre un día según el
 * huso del navegador. Acá el día es un string y la aritmética va en UTC.
 */

export const CIVIL_TZ = 'America/El_Salvador';

export type CivilDate = string;
export type CivilRange = { from: CivilDate; to: CivilDate };

export const RANGE_PRESETS = [
  { key: 'today', label: 'Hoy' },
  { key: '7d', label: '7 días' },
  { key: 'month', label: 'Este mes' },
] as const;

export type RangePresetKey = (typeof RANGE_PRESETS)[number]['key'];

const CIVIL_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function todayCivil(now: Date = new Date()): CivilDate {
  return now.toLocaleDateString('en-CA', { timeZone: CIVIL_TZ });
}

export function parseCivil(civil: CivilDate): Date {
  const parts = civil.split('-').map(Number);
  return new Date(Date.UTC(parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1));
}

export function toCivil(date: Date): CivilDate {
  return date.toISOString().slice(0, 10);
}

export function isCivil(value: string): boolean {
  if (!CIVIL_RE.test(value)) return false;
  return toCivil(parseCivil(value)) === value;
}

export function addDays(civil: CivilDate, days: number): CivilDate {
  const date = parseCivil(civil);
  date.setUTCDate(date.getUTCDate() + days);
  return toCivil(date);
}

export function addMonths(civil: CivilDate, months: number): CivilDate {
  const date = parseCivil(civil);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return toCivil(date);
}

export function firstOfMonth(civil: CivilDate): CivilDate {
  return `${civil.slice(0, 8)}01`;
}

/** `YYYY-MM-DD` → `dd/mm/yyyy`. */
export function formatCivil(civil: CivilDate): string {
  if (civil === '') return '';
  const [year, month, day] = civil.split('-');
  if (!year || !month || !day) return civil;
  return `${day}/${month}/${year}`;
}

/** `dd/mm/yyyy` → `YYYY-MM-DD`, o `null` si no es un día real. */
export function parseTyped(text: string): CivilDate | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (match === null) return null;
  const civil = `${match[3]}-${match[2]}-${match[1]}`;
  return isCivil(civil) ? civil : null;
}

/** Solo dígitos; las barras las pone el campo. */
export function maskDate(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

const monthFormatter = new Intl.DateTimeFormat('es-SV', { month: 'long', timeZone: 'UTC' });
const longFormatter = new Intl.DateTimeFormat('es-SV', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const shortFormatter = new Intl.DateTimeFormat('es-SV', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

export const MONTHS: readonly string[] = Array.from({ length: 12 }, (_, index) =>
  monthFormatter.format(Date.UTC(2026, index, 1)),
);

/** Semana desde el lunes. */
export const WEEKDAYS = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'] as const;

export function monthLabel(civil: CivilDate): string {
  const month = Number(civil.slice(5, 7));
  return `${MONTHS[month - 1] ?? ''} ${civil.slice(0, 4)}`;
}

export function longLabel(civil: CivilDate): string {
  return longFormatter.format(parseCivil(civil));
}

function shortDay(civil: CivilDate): string {
  return shortFormatter.format(parseCivil(civil)).replace(/\./g, '');
}

/** Las 42 celdas del mes, empezando en lunes. */
export function monthCells(civil: CivilDate): CivilDate[] {
  const first = parseCivil(firstOfMonth(civil));
  const offset = (first.getUTCDay() + 6) % 7;
  const start = addDays(toCivil(first), -offset);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export function presetRange(key: RangePresetKey, today: CivilDate = todayCivil()): CivilRange {
  if (key === 'today') return { from: today, to: today };
  if (key === '7d') return { from: addDays(today, -6), to: today };
  return { from: firstOfMonth(today), to: today };
}

export function matchingPreset(range: CivilRange, today: CivilDate = todayCivil()): RangePresetKey | '' {
  if (range.from === '' || range.to === '') return '';
  for (const preset of RANGE_PRESETS) {
    const value = presetRange(preset.key, today);
    if (value.from === range.from && value.to === range.to) return preset.key;
  }
  return '';
}

export function rangeDayCount(range: CivilRange): number {
  return Math.round((parseCivil(range.to).getTime() - parseCivil(range.from).getTime()) / 86_400_000) + 1;
}

/**
 * Cerrado, el disparador dice extremos y cuenta:
 * `31 ago – 6 sep 2026 · 7 días`. El año del inicial solo si difiere.
 */
export function rangeSummary(range: CivilRange): string {
  const days = rangeDayCount(range);
  const count = `${days} ${days === 1 ? 'día' : 'días'}`;
  const year = range.to.slice(0, 4);
  if (range.from === range.to) return `${shortDay(range.to)} ${year} · ${count}`;
  const startYear = range.from.slice(0, 4) === year ? '' : ` ${range.from.slice(0, 4)}`;
  return `${shortDay(range.from)}${startYear} – ${shortDay(range.to)} ${year} · ${count}`;
}
