import type { Page } from '@elite/shared';

/**
 * Formato del inventario (spec 065).
 *
 * Las cantidades viajan como cadena de tres decimales (`"2.500"`) y el dinero
 * con dos (`"14.00"`). Acá nunca pasan por un `number` de coma flotante: se
 * cuentan en milésimas enteras, igual que la caja cuenta en centavos.
 */

const TIME_ZONE = 'America/El_Salvador';

/** Signo menos tipográfico: se lee mejor que el guion en una columna de cifras. */
const MINUS = '−';

const DATE = new Intl.DateTimeFormat('es-SV', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const TIME = new Intl.DateTimeFormat('es-SV', {
  timeZone: TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
});

function tidy(text: string): string {
  return text
    .replaceAll(/[\u202f\u00a0]/gu, ' ')
    .replace('a. m.', 'a.m.')
    .replace('p. m.', 'p.m.');
}

/** «26 sept 2026», en la hora del taller. */
export function formatMovementDate(iso: string): string {
  return tidy(DATE.format(new Date(iso)));
}

/** «3:05 p.m.», en la hora del taller. */
export function formatMovementTime(iso: string): string {
  return tidy(TIME.format(new Date(iso)));
}

/**
 * Milésimas enteras de una cantidad (`"2.500"` → `2500`), o `null` si el texto
 * no es una cantidad. Acepta signo y hasta tres decimales.
 */
export function quantityMilli(value: string): number | null {
  const match = /^([+-]?)(\d+)(?:\.(\d{1,3}))?$/.exec(value.trim());
  if (match === null) return null;

  const [, sign, whole, fraction = ''] = match;
  const milli = Number(whole) * 1000 + Number(fraction.padEnd(3, '0'));

  return sign === '-' ? -milli : milli;
}

/** La vuelta de `quantityMilli`: `2500` → `"2.500"`, `-1000` → `"-1.000"`. */
export function milliToQuantity(milli: number): string {
  const negative = milli < 0;
  const absolute = Math.abs(Math.trunc(milli));
  const text = `${Math.trunc(absolute / 1000)}.${String(absolute % 1000).padStart(3, '0')}`;

  return negative ? `-${text}` : text;
}

/**
 * Una cantidad para leer: sin los ceros que sobran. `"2.500"` → `"2.5"`,
 * `"10.000"` → `"10"`, `"-2.000"` → `"−2"`.
 */
export function formatQuantity(value: string): string {
  const milli = quantityMilli(value);
  if (milli === null) return value;

  const absolute = Math.abs(milli);
  const whole = Math.trunc(absolute / 1000);
  const fraction = String(absolute % 1000)
    .padStart(3, '0')
    .replace(/0+$/, '');
  const text = fraction === '' ? String(whole) : `${whole}.${fraction}`;

  return milli < 0 ? `${MINUS}${text}` : text;
}

/** La cantidad con su signo siempre a la vista: `"+10"`, `"−2"`. */
export function formatSignedQuantity(value: string): string {
  const milli = quantityMilli(value);
  if (milli === null) return value;
  if (milli <= 0) return formatQuantity(value);

  return `+${formatQuantity(value)}`;
}

/** «4 unidad» se lee raro; la unidad va tal cual la escribió el taller. */
export function formatQuantityWithUnit(value: string, unit: string): string {
  const trimmed = unit.trim();

  return trimmed === '' ? formatQuantity(value) : `${formatQuantity(value)} ${trimmed}`;
}

/** `"14.00"` → `"$14.00"`. */
export function formatMoney(amount: string): string {
  return `$${amount}`;
}

/** «Hay 4 litro», la frase que ve quien intenta sacar de más (RN-3). */
export function availableLabel(available: string, unit?: string): string {
  return `Hay ${unit === undefined ? formatQuantity(available) : formatQuantityWithUnit(available, unit)}`;
}

/** El número de referencia de un artículo: `INV-0012` → `12` (misma regla que el lavado). */
export function itemReference(code: string): number {
  const sequence = Number(code.slice(code.indexOf('-') + 1));

  return Number.isFinite(sequence) ? sequence : 0;
}

/** «1–50 de 120 movimientos». Una página vacía dice «0 movimientos». */
export function pageSummary<T>(page: Page<T>, noun: { one: string; many: string }): string {
  const word = page.total === 1 ? noun.one : noun.many;
  if (page.total === 0 || page.items.length === 0) return `${page.total} ${word}`;

  const first = (page.page - 1) * page.pageSize + 1;
  const last = first + page.items.length - 1;

  if (first === 1 && last === page.total) return `${page.total} ${word}`;

  return `${first}–${last} de ${page.total} ${word}`;
}

/** Cuántas páginas tiene el filtro. Siempre al menos una. */
export function pageCount<T>(page: Page<T>): number {
  return Math.max(1, Math.ceil(page.total / Math.max(page.pageSize, 1)));
}

/** El número de referencia de una fila dentro de una lista paginada. */
export function pagedReference<T>(page: Page<T> | undefined, index: number): number {
  if (page === undefined) return index + 1;

  return (page.page - 1) * page.pageSize + index + 1;
}
