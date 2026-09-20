import { NAV_ITEMS } from '@/components/app-shell/nav-items';

/**
 * A dónde se vuelve desde una pantalla hija (DESIGN.md → Enlace de regreso).
 *
 * El riel dice en qué módulo estás; este enlace dice cómo salir de la ficha que
 * abriste dentro de él. Nombra **solo al padre**: el árbol del sistema tiene un
 * nivel de hondura y una cadena de migas prometía una jerarquía que no existe.
 *
 * Es estructural, nunca `router.back()`. El historial miente cuando se llega
 * por enlace directo, tras una recarga o después de un `router.replace` —que es
 * justo lo que hace el alta de lavado al terminar—; la ruta no.
 *
 * No hay mapa que mantener: las raíces son las pestañas del riel, así que
 * agregar una subpantalla no obliga a registrarla en ningún lado.
 *
 * Con una salvedad, la de la spec 056: una ficha con **varias puertas de
 * entrada** —un lavado se abre desde la lista, desde la caja, desde la ficha de
 * su cliente y desde la campana— no puede adivinar por cuál entraste. Quien
 * navega lo anota en la URL (`?from=`) y este módulo lo lee. Sigue sin ser
 * historial: viaja en la ruta, aguanta la recarga y se puede compartir.
 */

export interface BackLinkTarget {
  label: string;
  href: string;
}

/**
 * La pista no es una pestaña del riel —no tiene riel: se trabaja de pie, con
 * una sola cosa que hacer (RN-0 de la spec 003)—, así que su raíz es la única
 * que se declara a mano. La etiqueta es la misma con la que se titula
 * `FloorQueue`: el enlace promete lo que la pantalla cumple.
 */
const FLOOR_ROOT: BackLinkTarget = { href: '/floor', label: 'Lavados activos' };

const ROOTS: readonly BackLinkTarget[] = [
  ...NAV_ITEMS.map(({ href, label }) => ({ href, label })),
  FLOOR_ROOT,
];

/** El parámetro que lleva el origen cuando la estructura no alcanza (spec 056). */
export const BACK_PARAM = 'from';

/** Un `from` más largo que esto no lo escribió esta app. */
const MAX_ORIGIN_LENGTH = 512;

/**
 * Las pantallas de detalle no son raíz de nada, así que no hay de dónde
 * derivarles el nombre: es la única tabla que esta pieza mantiene a mano
 * (RN-5 de la spec 056). Se nombra la pantalla, no su módulo: volver a un turno
 * cerrado y que el enlace diga «Caja» sería mentir a medias.
 */
const DETAIL_LABELS: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /^\/carwash\/cash\/[^/]+$/, label: 'Turno' },
  { pattern: /^\/customers\/[^/]+$/, label: 'Cliente' },
  { pattern: /^\/carwash\/[^/]+$/, label: 'Lavado' },
];

/** La ruta sin su query: lo que se compara contra las raíces. */
function pathOf(url: string): string {
  const query = url.indexOf('?');
  return query === -1 ? url : url.slice(0, query);
}

/** La raíz más honda que sea prefijo estricto de la ruta, que es la más cercana. */
function rootOf(pathname: string): BackLinkTarget | null {
  return (
    ROOTS.filter((root) => pathname.startsWith(`${root.href}/`)).sort(
      (left, right) => right.href.length - left.href.length,
    )[0] ?? null
  );
}

/** Cómo se llama esa pantalla en el enlace: raíz del riel, detalle conocido, o su módulo. */
export function labelFor(pathname: string): string {
  const root = ROOTS.find((candidate) => candidate.href === pathname);
  if (root) return root.label;

  const detail = DETAIL_LABELS.find(({ pattern }) => pattern.test(pathname));
  if (detail) return detail.label;

  return rootOf(pathname)?.label ?? 'Volver';
}

/**
 * El origen si se puede confiar en él, `null` si no (RN-3 de la spec 056).
 *
 * Un `from` llega de la URL, así que llega de cualquiera. Se acepta solo lo que
 * esta app pudo haber escrito: una ruta interna, de una raíz conocida, que no
 * sea la pantalla en la que ya estás. Todo lo demás —una URL absoluta, un
 * `//host` que el navegador leería como otro sitio, un `..`— se descarta y el
 * regreso vuelve a ser el estructural.
 */
export function safeOrigin(value: string | null | undefined, pathname: string): string | null {
  if (!value) return null;
  if (value.length > MAX_ORIGIN_LENGTH) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//') || value.startsWith('/\\')) return null;
  if (value.includes('..')) return null;

  const path = pathOf(value);
  if (path === pathname) return null;
  if (!ROOTS.some((root) => root.href === path) && rootOf(path) === null) return null;

  return value;
}

/**
 * El padre de esta ruta, o `null` si ya es de primer nivel.
 *
 * Con un `from` válido gana el origen: es lo que el usuario tiene en la cabeza.
 * Sin él, la estructura, exactamente como en la spec 008.
 *
 * La coincidencia exacta con una raíz no cuenta: esa es la pantalla actual, y
 * una pantalla de primer nivel no dibuja regreso aunque le cuelguen un `from`.
 */
export function backLinkFor(pathname: string, origin?: string | null): BackLinkTarget | null {
  if (ROOTS.some((root) => root.href === pathname)) return null;

  const from = safeOrigin(origin, pathname);
  if (from !== null) return { href: from, label: labelFor(pathOf(from)) };

  return rootOf(pathname);
}

/**
 * El mismo destino, anotando de dónde se sale hacia él.
 *
 * No anota de más (RN-4): si el regreso estructural del destino ya es el
 * origen, la URL queda como estaba. Así entrar a un lavado desde la lista sigue
 * dando `/carwash/<id>` pelado, y solo las entradas de costado —caja, cliente,
 * campana, o la lista con fecha y búsqueda puestas— cargan el parámetro.
 */
export function withBackTo(href: string, origin: string): string {
  const path = pathOf(href);
  const structural = backLinkFor(path);
  if (structural === null) return href;
  if (structural.href === origin) return href;
  if (safeOrigin(origin, path) === null) return href;

  const separator = href.includes('?') ? '&' : '?';
  return `${href}${separator}${BACK_PARAM}=${encodeURIComponent(origin)}`;
}

/**
 * Dónde está parado el usuario ahora mismo, con sus filtros.
 *
 * Se llama **dentro de un manejador de evento**, nunca en render: la fecha y la
 * búsqueda de la lista de lavados se escriben con `history.replaceState`, así
 * que viven en `window.location` y `useSearchParams` no las ve.
 */
export function currentOrigin(): string {
  return `${window.location.pathname}${window.location.search}`;
}
