'use client';

import { useEffect, useState } from 'react';

import { replaceQuery } from '@/lib/list-params';

/**
 * La query actual con `key` puesto en `page`; la primera página no se escribe
 * y lo demás que traiga la barra se conserva (102).
 */
export function withUrlPage(search: string, key: string, page: number): string {
  const params = new URLSearchParams(search);

  params.delete(key);
  if (page > 1) params.set(key, String(page));

  return params.toString();
}

/**
 * Una página con nombre propio en la URL (`?vehiclesPage=`, `?paymentsPage=`),
 * para las pantallas con más de una lista paginada (102). La lista principal
 * usa `useListPage` con `?page=`.
 */
export function useUrlPage(key: string, initial: number): [number, (page: number) => void] {
  const [page, setPage] = useState(initial);

  useEffect(() => {
    replaceQuery(withUrlPage(window.location.search, key, page));
  }, [key, page]);

  return [page, setPage];
}
