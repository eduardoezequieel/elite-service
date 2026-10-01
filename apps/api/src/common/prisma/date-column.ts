/**
 * Columnas `@db.Date` de Prisma ⇄ fechas civiles `YYYY-MM-DD` del contrato
 * (spec 095).
 *
 * Postgres guarda el día sin hora y Prisma lo entrega como un `Date` a la
 * medianoche UTC. Se lee y se escribe siempre en UTC: con la hora local del
 * servidor, el 5 de marzo saldría 4 de marzo a las 18:00 en El Salvador.
 */

/** `"2026-03-05"` → `Date` a la medianoche UTC de ese día. */
export function civilToDate(civil: string): Date {
  return new Date(`${civil}T00:00:00.000Z`);
}

/** El día de una columna `@db.Date`, o `null`. */
export function dateToCivil(date: Date | null): string | null {
  return date === null ? null : date.toISOString().slice(0, 10);
}

/** Para escribir un campo civil opcional: `undefined` no se toca, `null` borra. */
export function civilColumn(civil: string | null | undefined): Date | null | undefined {
  if (civil === undefined) return undefined;
  return civil === null ? null : civilToDate(civil);
}
