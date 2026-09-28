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

/**
 * Si un P2002 choco en el indice `index`, por su nombre (090).
 *
 * Para los unicos parciales que se crean a mano en una migracion: su nombre no
 * sigue el `<tabla>_<columnas>_key` de Prisma, asi que `uniqueViolationOn` no
 * puede sacarle las columnas. El motor clasico deja el nombre en
 * `meta.target`; el adaptador, en `constraint.index`.
 */
export function uniqueViolationOnIndex(error: unknown, index: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }

  const target = error.meta?.target;

  if (target === index || (isStringArray(target) && target.includes(index))) return true;

  const constraint = field(field(field(error.meta, 'driverAdapterError'), 'cause'), 'constraint');

  return field(constraint, 'index') === index;
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
