/**
 * Dinero en el web (spec 076): un nombre por significado.
 *
 * El API manda montos como cadena de dos decimales (`"8.50"`). Una pantalla que
 * suma lo hace en centavos enteros y vuelve acá para dibujar; nunca pasa por un
 * `number` de coma flotante. Solo formato: los descuentos y el reparto de pagos
 * viven en su feature.
 */

/** Un monto del API para leer: `"14.00"` → `"$14.00"`. */
export function formatMoney(amount: string): string {
  return `$${amount}`;
}

/** Centavos enteros para leer: `1250` → `"$12.50"`, `-300` → `"-$3.00"`. */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(Math.round(cents));

  return `${sign}$${Math.trunc(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}

/** Centavos de un monto del API (`"8.50"` → `850`), o `null` si el texto no es un monto. */
export function toCents(amount: string): number | null {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim());

  if (match === null) return null;

  const [, sign, whole, fraction = ''] = match;
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));

  return sign === '-' ? -cents : cents;
}

/**
 * Centavos de lo que se está tecleando (`"8,5"` → `850`, `""` → `0`). A
 * diferencia de `toCents`, acepta coma y medio escribir, y lo ilegible es cero.
 */
export function parseCents(value: string): number {
  const parsed = Number.parseFloat(value.replace(',', '.'));

  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

/** Centavos de vuelta a monto sin símbolo, como lo espera el API: `850` → `"8.50"`. */
export function centsToAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Un monto del API en dos tamaños: `"148.5"` → `{ whole: "$148", fraction: ".50" }`. */
export function moneyParts(amount: string): { whole: string; fraction: string } {
  const [whole = '0', fraction = '00'] = amount.split('.');

  return { whole: `$${whole}`, fraction: `.${fraction.padEnd(2, '0')}` };
}

/** Centavos ya sumados en dos tamaños: `14800` → `{ whole: "$148", fraction: ".00" }`. */
export function centsParts(cents: number): { whole: string; fraction: string } {
  return {
    whole: `$${Math.trunc(cents / 100)}`,
    fraction: `.${String(Math.abs(cents % 100)).padStart(2, '0')}`,
  };
}
