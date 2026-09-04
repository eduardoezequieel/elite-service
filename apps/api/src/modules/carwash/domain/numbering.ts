/**
 * Numeracion correlativa de tickets y servicios (RN-15).
 *
 * `CW-0014` es el numero que viaja en los datos y se imprime; en pantalla el
 * usuario ve `#14`, sin prefijo y sin ceros, que es como lo dice en voz alta
 * ["catorce"]. Los dos salen del mismo entero.
 */

/** Digitos del correlativo. Cuatro alcanzan para 9999 lavados por serie. */
const WIDTH = 4;

export const TICKET_PREFIX = 'CW';
export const SERVICE_PREFIX = 'SRV';

/** `('CW', 14)` → `'CW-0014'`. */
export function formatNumber(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(WIDTH, '0')}`;
}

/**
 * `'CW-0014'` → `14`. Devuelve `null` si no tiene esa forma.
 *
 * Se usa para leer el ultimo correlativo de la base y sacar el siguiente, asi
 * que tolera mas de cuatro digitos: pasado `CW-9999` la serie sigue en
 * `CW-10000` en vez de romperse.
 */
export function parseSequence(prefix: string, value: string): number | null {
  const match = new RegExp(`^${prefix}-(\\d+)$`).exec(value.trim());

  if (match === null) return null;

  const sequence = Number(match[1]);

  return Number.isSafeInteger(sequence) ? sequence : null;
}

/**
 * El numero que sigue al ultimo emitido. Sin ultimo, empieza en 1.
 *
 * Quien lo llame tiene que hacerlo dentro de la misma transaccion que inserta
 * la fila: `number` es unico en la base, asi que dos altas simultaneas chocan
 * ahi y no se cuelan dos tickets con el mismo folio.
 */
export function nextNumber(prefix: string, lastNumber: string | null): string {
  const last = lastNumber === null ? 0 : (parseSequence(prefix, lastNumber) ?? 0);

  return formatNumber(prefix, last + 1);
}

/** `'CW-0014'` → `'#14'`, que es lo que se muestra en pantalla (RN-15). */
export function toReferenceLabel(value: string): string {
  const separator = value.indexOf('-');

  if (separator === -1) return `#${value}`;

  const sequence = Number(value.slice(separator + 1));

  return Number.isFinite(sequence) ? `#${sequence}` : `#${value.slice(separator + 1)}`;
}
