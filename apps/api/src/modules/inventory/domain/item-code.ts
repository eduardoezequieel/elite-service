/**
 * Código correlativo del artículo: `INV-0001` (065 RN-15).
 *
 * Lo genera el API, nunca quien da de alta. Quien lo llame tiene que leer el
 * último y guardar el nuevo en la misma transacción: `code` es único en la base,
 * así que dos altas simultáneas chocan ahí en vez de repetir código.
 */

export const ITEM_CODE_PREFIX = 'INV';

/** Dígitos del correlativo. Pasado `INV-9999` sigue en `INV-10000`. */
const WIDTH = 4;

/** `7` → `'INV-0007'`. */
export function formatItemCode(sequence: number): string {
  return `${ITEM_CODE_PREFIX}-${String(sequence).padStart(WIDTH, '0')}`;
}

/** `'INV-0007'` → `7`; `null` si no tiene esa forma. */
export function parseItemCode(code: string): number | null {
  const match = new RegExp(`^${ITEM_CODE_PREFIX}-(\\d+)$`).exec(code.trim());

  if (match === null) return null;

  const sequence = Number(match[1]);

  return Number.isSafeInteger(sequence) ? sequence : null;
}

/**
 * El código que sigue al mayor de los emitidos. Recibe todos los que haya (o
 * solo el último): un código ajeno a la serie se ignora en vez de romperla.
 */
export function nextItemCode(existing: readonly string[]): string {
  let highest = 0;

  for (const code of existing) {
    const sequence = parseItemCode(code);

    if (sequence !== null && sequence > highest) highest = sequence;
  }

  return formatItemCode(highest + 1);
}
