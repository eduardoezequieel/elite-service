import type { Page, PageQuery } from '@elite/shared';

/**
 * El recorte de una lista paginada (`Page<T>` de shared, spec 101), sin ORM.
 *
 * `pageSkip` es el `skip` de Prisma para una página; `slicePage` arma la página
 * de una lista que ya está entera en memoria — la que se calcula y no se lee
 * de una tabla (saldos, rentabilidad, gastos de tres orígenes).
 */
export function pageSkip(query: PageQuery): number {
  return (query.page - 1) * query.pageSize;
}

export function slicePage<T>(rows: readonly T[], query: PageQuery): Page<T> {
  const start = pageSkip(query);

  return {
    items: rows.slice(start, start + query.pageSize),
    page: query.page,
    pageSize: query.pageSize,
    total: rows.length,
  };
}
