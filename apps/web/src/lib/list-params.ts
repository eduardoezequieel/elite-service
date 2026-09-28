/**
 * El estado de una lista en la URL (056, 065, 076): lo que se lee de los
 * `searchParams` de la página y cómo se escribe de vuelta sin navegar. Cada
 * feature arma su propia query encima de esto.
 */

/** Un valor de `searchParams` tal como lo entrega Next. */
export type SearchValue = string | string[] | undefined | null;

/** El valor si vino una sola vez; repetido o ausente es `null`. */
export function singleParam(value: SearchValue): string | null {
  return typeof value === 'string' ? value : null;
}

/** La página de la URL si es un entero desde 1; si no, la primera. */
export function pageParam(value: SearchValue): number {
  const page = Number(singleParam(value));

  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/** La ruta actual con esa query; vacía deja la ruta limpia. */
function hrefWith(query: string): string {
  return query === '' ? window.location.pathname : `${window.location.pathname}?${query}`;
}

function currentHref(): string {
  return `${window.location.pathname}${window.location.search}`;
}

/** Escribe la query en la barra sin navegar, como la lista de lavados (056). */
export function replaceQuery(query: string): void {
  const next = hrefWith(query);
  if (currentHref() === next) return;
  window.history.replaceState(null, '', next);
}

/**
 * Como {@link replaceQuery}, pero apila una entrada: el «atrás» del navegador
 * vuelve a la anterior (Rendimiento, al elegir un empleado, 067).
 */
export function pushQuery(query: string): void {
  const next = hrefWith(query);
  if (currentHref() === next) return;
  window.history.pushState(null, '', next);
}
