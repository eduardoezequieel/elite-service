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
const FLOOR_ROOT: BackLinkTarget = { href: '/floor', label: 'La fila' };

const ROOTS: readonly BackLinkTarget[] = [
  ...NAV_ITEMS.map(({ href, label }) => ({ href, label })),
  FLOOR_ROOT,
];

/**
 * El padre de esta ruta, o `null` si ya es de primer nivel.
 *
 * La coincidencia exacta no cuenta: esa es la pantalla actual, no su padre. De
 * haber varias raíces que encajen gana la más honda, que es la más cercana.
 */
export function backLinkFor(pathname: string): BackLinkTarget | null {
  if (ROOTS.some((root) => root.href === pathname)) return null;

  return (
    ROOTS.filter((root) => pathname.startsWith(`${root.href}/`)).sort(
      (left, right) => right.href.length - left.href.length,
    )[0] ?? null
  );
}
