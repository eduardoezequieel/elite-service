import type { Page, PageQuery } from '@elite/shared';

/**
 * Las piezas de una lista paginada (specs 065, 101, 102): toda lista del API es
 * un `Page<T>` de `@elite/shared`. El repositorio pide `skipTake(query)` junto
 * con su `count` en una transacción y arma la respuesta con `pageOf`; lo que se
 * calcula en memoria —un reporte, saldos, gastos de tres orígenes, un
 * repositorio de tests— recorta con `slicePage`.
 */

/** El `skip` de Prisma para esa página. */
export function pageSkip(query: PageQuery): number {
  return (query.page - 1) * query.pageSize;
}

/** El `skip`/`take` de Prisma para esa página. */
export function skipTake(query: PageQuery): { skip: number; take: number } {
  return { skip: pageSkip(query), take: query.pageSize };
}

/** La respuesta con las filas ya recortadas y el total del filtro entero. */
export function pageOf<T>(items: T[], total: number, query: PageQuery): Page<T> {
  return { items, page: query.page, pageSize: query.pageSize, total };
}

/** Recorta en memoria una lista ya ordenada. */
export function slicePage<T>(rows: readonly T[], query: PageQuery): Page<T> {
  const { skip, take } = skipTake(query);

  return pageOf(rows.slice(skip, skip + take), rows.length, query);
}
