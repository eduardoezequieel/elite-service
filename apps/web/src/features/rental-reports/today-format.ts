/**
 * El título de Hoy (107): «Hoy, 5 de oct». El mes va en tres letras, sin punto.
 */

const MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const;

/** `YYYY-MM-DD` → `5 de oct`. */
export function shortCivil(date: string): string {
  const day = Number(date.slice(8, 10));
  const month = MONTHS[Number(date.slice(5, 7)) - 1] ?? '';

  return `${day} de ${month}`;
}

/** El título de la pantalla. */
export function todayTitle(date: string): string {
  return `Hoy, ${shortCivil(date)}`;
}
