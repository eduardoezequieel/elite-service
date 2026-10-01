import { formatCivil, parseTyped } from '@/lib/civil-date';

/**
 * El puente entre lo que se escribe en los formularios de la rentadora y el
 * cuerpo del pedido (095). El formulario trabaja con texto —un campo vacío es
 * `''`— y el contrato con `null`, números y fechas `YYYY-MM-DD`. La regla sigue
 * siendo una sola: la del schema de `@elite/shared`, que valida después.
 */

/** Vacío es `null`: borrar el dato. */
export function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Monto con coma o punto; vacío es `null`. Lo ilegible sigue como texto y lo rechaza el schema. */
export function moneyOrNull(value: string): string | null {
  const trimmed = value.trim().replace(',', '.');
  return trimmed === '' ? null : trimmed;
}

/** Entero escrito; vacío es `null`. Lo que no es un entero sigue como texto. */
export function wholeOrNull(value: string): number | string | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
}

/** `dd/mm/aaaa` → `YYYY-MM-DD`; vacío es `null`. */
export function civilOrNull(value: string): string | null {
  return value.trim() === '' ? null : parseTyped(value);
}

/** `true` si el campo de fecha está vacío o trae un día real. */
export function isTypedDateValid(value: string): boolean {
  return value.trim() === '' || parseTyped(value) !== null;
}

/** El mensaje de un campo de fecha mal escrito. */
export const TYPED_DATE_MESSAGE = 'Escribí la fecha como dd/mm/aaaa.';

/** Una fecha del contrato al campo: `"2026-03-05"` → `"05/03/2026"`. */
export function civilToField(civil: string | null): string {
  return civil === null ? '' : formatCivil(civil);
}

/** Un número del contrato al campo. */
export function numberToField(value: number | null): string {
  return value === null ? '' : String(value);
}
