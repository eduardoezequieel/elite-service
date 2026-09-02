/**
 * Ruta de ficha por pantalla (DESIGN.md → Breadcrumb).
 *
 * El riel dice en qué módulo estás; este rastro dice en qué ficha, como el
 * número de catálogo de una pieza. Un tramo sin `href` no se toca: no hay
 * pantalla detrás. El último tramo es siempre la página actual.
 *
 * Agregar una pantalla es agregar una entrada acá. El `AppShell` lo resuelve
 * solo a partir del pathname.
 */

export interface BreadcrumbCrumb {
  label: string;
  href?: string;
}

export const BREADCRUMB_TRAILS: Readonly<Record<string, readonly BreadcrumbCrumb[]>> = {
  '/carwash/nuevo': [
    { label: 'Lavados', href: '/carwash' },
    { label: 'Nuevo lavado' },
  ],
  '/carwash': [
    { label: 'Lavados' },
  ],
  '/settings/catalog': [
    { label: 'Configuración' },
    { label: 'Catálogo' },
  ],
  '/settings/employees': [
    { label: 'Configuración' },
    { label: 'Empleados' },
  ],
  '/settings/users': [
    { label: 'Configuración' },
    { label: 'Usuarios' },
  ],
  '/settings/roles': [
    { label: 'Configuración' },
    { label: 'Roles y permisos' },
  ],
};

/** El rastro de esta ruta, o el de la ruta padre más larga. `null` si no hay. */
export function breadcrumbTrailFor(pathname: string): readonly BreadcrumbCrumb[] | null {
  const exact = BREADCRUMB_TRAILS[pathname];
  if (exact) return exact;

  const prefix = Object.keys(BREADCRUMB_TRAILS)
    .filter((path) => pathname === path || pathname.startsWith(`${path}/`))
    .sort((left, right) => right.length - left.length)[0];

  return prefix === undefined ? null : BREADCRUMB_TRAILS[prefix];
}
