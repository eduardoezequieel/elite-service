import { Prisma } from '@prisma/client';

/**
 * Si un P2002 choco en la columna `field` (080).
 *
 * Se compara columna por columna, nunca buscando el texto dentro de `meta`:
 * `'code'` esta adentro de `'barcode'`, y un choque en el codigo de barras se
 * leeria como un choque del correlativo.
 *
 * Prisma deja las columnas en dos lugares segun el motor:
 * - `meta.target`: el arreglo de columnas del motor clasico.
 * - `meta.driverAdapterError.cause.constraint`: lo que deja el adaptador de
 *   Prisma 7 (`@prisma/adapter-pg`), con las columnas (`fields`) o, lo que
 *   Postgres manda casi siempre, el nombre del indice (`index`), que Prisma
 *   arma como `<tabla>_<col1>_<col2>_key`. Las columnas de este esquema son
 *   camelCase, sin `_`, asi que el nombre se parte sin ambiguedad.
 */
export function uniqueViolationOn(error: unknown, field: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }

  return uniqueColumns(error.meta).includes(field);
}

function uniqueColumns(meta: Record<string, unknown> | undefined): string[] {
  if (meta === undefined) return [];

  if (isStringArray(meta.target)) return meta.target;

  const cause = field(field(meta, 'driverAdapterError'), 'cause');
  const constraint = field(cause, 'constraint');
  const fields = field(constraint, 'fields');

  if (isStringArray(fields)) return fields;

  const index = field(constraint, 'index');

  if (typeof index !== 'string' || !index.endsWith('_key')) return [];

  const table = field(cause, 'table');
  const withoutKey = index.slice(0, -'_key'.length);
  const columns =
    typeof table === 'string' && withoutKey.startsWith(`${table}_`)
      ? withoutKey.slice(table.length + 1)
      : withoutKey;

  return columns.split('_');
}

function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
