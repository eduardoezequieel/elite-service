'use client';

import { useEffect, useState } from 'react';

import { replaceQuery } from '@/lib/list-params';

/** La query de la pantalla con su `page`; la primera página no se escribe. */
export function withPageQuery(base: string, page: number): string {
  const params = new URLSearchParams(base);

  params.delete('page');
  if (page > 1) params.set('page', String(page));

  return params.toString();
}

/**
 * La página de una lista paginada en servidor (spec 102), en la URL como
 * `?page=`. Lo demás que traiga la barra —el tipo, el `?from=` del regreso—
 * se conserva.
 *
 * `narrowedBy` es la huella de la búsqueda y los filtros: cuando cambia, la
 * lista vuelve sola a la primera página —la 3 de otro filtro puede no existir.
 */
export function useListPage(
  initialPage: number,
  narrowedBy: string,
): [number, (page: number) => void] {
  const [paging, setPaging] = useState({ narrowedBy, page: initialPage });
  const page = paging.narrowedBy === narrowedBy ? paging.page : 1;

  useEffect(() => {
    replaceQuery(withPageQuery(window.location.search, page));
  }, [page]);

  return [page, (next: number) => setPaging({ narrowedBy, page: next })];
}
