/**
 * Las listas de Ajustes de la renta (120): las fichas de accesorios y las
 * cláusulas del contrato. Todo devuelve una lista nueva; nada muta.
 */

const sameName = (a: string, b: string) =>
  a.trim().localeCompare(b.trim(), 'es', { sensitivity: 'base' }) === 0;

export type AddAccessoryResult =
  { ok: true; items: string[] } | { ok: false; reason: 'empty' | 'duplicate' };

/** Agrega arriba. Vacío o repetido (sin mirar mayúsculas ni tildes) no entra. */
export function addAccessory(items: readonly string[], name: string): AddAccessoryResult {
  const clean = name.trim();
  if (clean === '') return { ok: false, reason: 'empty' };
  if (items.some((item) => sameName(item, clean))) return { ok: false, reason: 'duplicate' };

  return { ok: true, items: [clean, ...items] };
}

/**
 * Renombra en su lugar. Vacío quita la ficha (`removed: true`); un nombre que
 * ya tiene otra ficha deja el anterior (`duplicate: true`).
 */
export function renameAccessory(
  items: readonly string[],
  index: number,
  name: string,
): { items: string[]; removed: boolean; duplicate: boolean } {
  const clean = name.trim();
  if (index < 0 || index >= items.length) {
    return { items: [...items], removed: false, duplicate: false };
  }
  if (clean === '') return { items: removeAt(items, index), removed: true, duplicate: false };
  if (items.some((item, position) => position !== index && sameName(item, clean))) {
    return { items: [...items], removed: false, duplicate: true };
  }

  return {
    items: items.map((item, position) => (position === index ? clean : item)),
    removed: false,
    duplicate: false,
  };
}

/** A–Z en español: «Ñ» después de «N», sin mirar mayúsculas. */
export function sortAccessories(items: readonly string[]): string[] {
  return [...items].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}

export function removeAt<T>(items: readonly T[], index: number): T[] {
  return items.filter((_, position) => position !== index);
}

/** Vuelve a poner un elemento donde estaba (el Deshacer). */
export function insertAt<T>(items: readonly T[], index: number, item: T): T[] {
  const at = Math.max(0, Math.min(index, items.length));

  return [...items.slice(0, at), item, ...items.slice(at)];
}

/** Escribe `token` en el lugar del cursor. Devuelve el texto y dónde queda el cursor. */
export function insertToken(
  text: string,
  token: string,
  start: number,
  end: number = start,
): { text: string; caret: number } {
  const from = Math.max(0, Math.min(start, text.length));
  const to = Math.max(from, Math.min(end, text.length));

  return { text: text.slice(0, from) + token + text.slice(to), caret: from + token.length };
}

/** Las cláusulas como un solo texto: una por párrafo, separadas por una línea en blanco. */
export function clausesToText(clauses: readonly string[]): string {
  return clauses.join('\n\n');
}

/**
 * El texto de vuelta a cláusulas: corta en cada línea en blanco y descarta los
 * párrafos vacíos. Un salto de línea simple queda dentro de su cláusula.
 */
export function textToClauses(text: string): string[] {
  return text
    .split(/\n[^\S\n]*\n/)
    .map((clause) => clause.trim())
    .filter((clause) => clause !== '');
}
