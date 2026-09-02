import { NAV_ITEMS } from '@/components/app-shell/nav-items';

/**
 * Ruta de ficha por pantalla (DESIGN.md → Breadcrumb).
 *
 * El riel dice en qué módulo estás; este rastro dice desde dónde llegaste. Lista
 * **solo los ancestros**: la pantalla actual ya la nombra el título del
 * `ScreenHeader`, y decirla dos veces era el ruido que había que sacar.
 *
 * No hay mapa que mantener. El rastro sale del propio riel, así que riel y
 * rastro no pueden discrepar y agregar una pantalla no obliga a registrarla en
 * dos sitios.
 */

export interface BreadcrumbCrumb {
  label: string;
  href: string;
}

/** Los ancestros de esta ruta, de más somero a más hondo. Vacío en primer nivel. */
export function breadcrumbTrailFor(pathname: string): readonly BreadcrumbCrumb[] {
  return (
    NAV_ITEMS
      // Ancestro **propio**: la coincidencia exacta es la pantalla actual, no un
      // tramo del rastro.
      .filter((item) => pathname.startsWith(`${item.href}/`))
      .sort((left, right) => left.href.length - right.href.length)
      .map(({ href, label }) => ({ href, label }))
  );
}
