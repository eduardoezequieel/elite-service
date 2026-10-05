import { Prisma } from '@prisma/client';

import { uniqueViolationOn } from './unique-violation';

/**
 * Las columnas que llevan un correlativo `PREFIJO-NNNN` (RN-15). Es una lista
 * cerrada porque tabla y columna entran al SQL como identificadores, no como
 * parametros: solo puede llegar lo que esta aca.
 */
const SEQUENCE_COLUMNS = {
  work_orders: 'number',
  charges: 'number',
  counter_sales: 'number',
  services: 'code',
  inventory_items: 'code',
  combos: 'code',
} as const;

export type SequenceTable = keyof typeof SEQUENCE_COLUMNS;

/** Cuantas veces se reintenta un alta que choco en el correlativo (073). */
export const SEQUENCE_ATTEMPTS = 3;

/**
 * Corre el alta y, si choca con el unique del correlativo —otra alta tomo el
 * mismo numero entre la lectura y la insercion—, la vuelve a correr entera
 * hasta `SEQUENCE_ATTEMPTS` veces. Al ultimo fallo sale el error tal cual; un
 * choque en otra columna sale en el primero.
 *
 * `run` tiene que abrir su propia transaccion: el reintento empieza de cero.
 */
export async function retryOnSequenceClash<T>(
  table: SequenceTable,
  run: () => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (attempt < SEQUENCE_ATTEMPTS && uniqueViolationOn(error, SEQUENCE_COLUMNS[table])) {
        continue;
      }
      throw error;
    }
  }
}

/**
 * El ultimo correlativo emitido con ese prefijo, o `null` si no hay ninguno.
 *
 * Ordena por largo y despues por texto: como texto `CW-9999` es mayor que
 * `CW-10000`, y ordenar solo por texto repetiria `CW-10000` para siempre (073).
 * Va con el `tx` de quien inserta: leer e insertar en la misma transaccion es
 * lo que deja que el unique de la columna frene dos altas simultaneas.
 */
export async function lastSequence(
  tx: Prisma.TransactionClient,
  table: SequenceTable,
  prefix: string,
): Promise<string | null> {
  const column = Prisma.raw(`"${SEQUENCE_COLUMNS[table]}"`);
  const pattern = `^${escapeRegExp(prefix)}-[0-9]+$`;

  const rows = await tx.$queryRaw<Array<{ value: string }>>`
    SELECT ${column} AS value FROM ${Prisma.raw(`"${table}"`)}
    WHERE ${column} ~ ${pattern}
    ORDER BY length(${column}) DESC, ${column} DESC
    LIMIT 1
  `;

  return rows[0]?.value ?? null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
