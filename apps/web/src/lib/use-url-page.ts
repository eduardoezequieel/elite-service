'use client';

import { useCallback, useEffect, useState } from 'react';

import { pageValue, replaceParam } from './list-params';

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
 * La página de una lista paginada en servidor (101), guardada en la URL con
 * su clave —`page` si la pantalla tiene una sola lista—. Cuando cambia
 * `resetKey` (otro filtro, otra búsqueda) vuelve a la primera en ese mismo
 * render: no se pide la página vieja con el filtro nuevo.
 */
export function useUrlPage(
  key: string,
  initial: number,
  resetKey = '',
): [number, (page: number) => void] {
  const [state, setState] = useState({ page: initial, resetKey });
  const page = state.resetKey === resetKey ? state.page : 1;

  const change = useCallback(
    (next: number) => {
      setState({ page: next, resetKey });
      replaceParam(key, pageValue(next));
    },
    [key, resetKey],
  );

  useEffect(() => {
    if (state.resetKey === resetKey) return;
    setState({ page: 1, resetKey });
    replaceParam(key, null);
  }, [key, resetKey, state.resetKey]);

  return [page, change];
}
