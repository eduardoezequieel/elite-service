/**
 * Cantidades en el web (spec 076).
 *
 * Viajan como cadena de tres decimales (`"2.500"`) y acá se cuentan en
 * milésimas enteras, igual que el dinero se cuenta en centavos: nunca pasan por
 * un `number` de coma flotante.
 */

/** Signo menos tipográfico: se lee mejor que el guion en una columna de cifras. */
const MINUS = '−';

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

/** La vuelta de `quantityMilli`, como la espera el API: `2500` → `"2.500"`, `-1000` → `"-1.000"`. */
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

/** La cantidad con su unidad tal cual la escribió el taller: `"4 litro"`. Sin unidad, sola. */
export function formatQuantityWithUnit(value: string, unit: string): string {
  const trimmed = unit.trim();

  return trimmed === '' ? formatQuantity(value) : `${formatQuantity(value)} ${trimmed}`;
}
