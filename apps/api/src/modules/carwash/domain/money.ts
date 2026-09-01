/**
 * Dinero, en centavos enteros.
 *
 * El dominio no toca decimales flotantes. `0.1 + 0.2` no da `0.3` en binario, y
 * un ticket es exactamente una suma de precios de dos decimales: con `number`
 * decimal, tres lineas de $8.10 se convierten en $24.299999999999997 y el cobro
 * de RN-10 —que exige monto **igual** al total— empieza a fallar por un error
 * que nadie puede ver en pantalla.
 *
 * La base guarda `Decimal(12, 2)` y la conversion vive en el borde: Prisma
 * entrega y recibe cadenas, `fromDecimalString` y `toDecimalString` traducen.
 * Adentro del dominio todo es entero.
 */

/** Un monto en centavos. Siempre entero; nunca negativo en esta spec. */
export type Cents = number;

/** Cuantos decimales guarda la base para dinero. */
const DECIMAL_PLACES = 2;
const CENTS_PER_UNIT = 100;

/**
 * Convierte lo que entrega la base (`"8.00"`, `"10"`, `"14.5"`) a centavos.
 *
 * Se parsea a mano en vez de con `Number()` para no pasar por punto flotante:
 * `Math.round(Number('8.07') * 100)` funciona hoy y falla el dia que aparezca
 * un valor donde el redondeo caiga del otro lado.
 *
 * @throws si la cadena no es un decimal con como mucho dos decimales.
 */
export function fromDecimalString(value: string): Cents {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());

  if (match === null) {
    throw new Error(`Monto invalido: ${JSON.stringify(value)}`);
  }

  const [, sign, whole, fraction = ''] = match;
  const cents = Number(whole) * CENTS_PER_UNIT + Number(fraction.padEnd(DECIMAL_PLACES, '0'));

  return sign === '-' ? -cents : cents;
}

/** Convierte centavos a la cadena decimal que espera la base: `1050` → `"10.50"`. */
export function toDecimalString(cents: Cents): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / CENTS_PER_UNIT);
  const fraction = absolute % CENTS_PER_UNIT;

  return `${sign}${whole}.${String(fraction).padStart(DECIMAL_PLACES, '0')}`;
}

/**
 * Convierte a centavos lo que llega del cliente, que puede mandar un numero
 * (`8`, `8.5`) o una cadena. Se normaliza a cadena antes de parsear para no
 * heredar el error del flotante.
 *
 * @throws si no representa un monto de dos decimales.
 */
export function toCents(value: number | string): Cents {
  if (typeof value === 'string') return fromDecimalString(value);

  if (!Number.isFinite(value)) {
    throw new Error(`Monto invalido: ${String(value)}`);
  }

  return fromDecimalString(value.toFixed(DECIMAL_PLACES));
}

/** Formatea centavos para mostrarlos: `1050` → `"$10.50"`. */
export function formatMoney(cents: Cents): string {
  return `$${toDecimalString(cents)}`;
}
