'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment, useMemo } from 'react';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

/**
 * El rastro de migas del área autenticada (spec 003 → RN-3).
 *
 * Se deriva de la ruta, nunca se escribe a mano en cada pantalla: agregar un
 * módulo es agregar su etiqueta a `SEGMENT_LABELS`, igual que las pestañas del
 * riel son un dato y no código.
 *
 * El riel dice en qué módulo estás; el rastro dice dónde está ese módulo. Por
 * eso es una línea de texto sobre el papel, sin barra ni fondo: no compite con
 * el título de la pantalla.
 */

/** El nombre visible de cada segmento de ruta, en español. */
const SEGMENT_LABELS: Record<string, string> = {
  settings: 'Configuración',
  users: 'Usuarios',
  roles: 'Roles y permisos',
};

/**
 * Segmentos que agrupan pero no tienen pantalla propia: se nombran, no se
 * enlazan. Un enlace que lleva a un 404 es peor que ningún enlace.
 */
const SEGMENTS_WITHOUT_SCREEN = new Set(['settings']);

interface Crumb {
  label: string;
  /** `null` cuando el segmento no tiene pantalla a la que ir. */
  href: string | null;
}

/** Un segmento desconocido se muestra tal cual, con la primera en mayúscula. */
function labelOf(segment: string): string {
  const known = SEGMENT_LABELS[segment];
  if (known !== undefined) return known;

  const readable = decodeURIComponent(segment).replace(/-/g, ' ');
  return readable.charAt(0).toUpperCase() + readable.slice(1);
}

export function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter((segment) => segment !== '');

  return segments.map((segment, index) => ({
    label: labelOf(segment),
    href: SEGMENTS_WITHOUT_SCREEN.has(segment)
      ? null
      : `/${segments.slice(0, index + 1).join('/')}`,
  }));
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const crumbs = useMemo(() => buildCrumbs(pathname), [pathname]);

  // En la raíz no hay rastro que mostrar: «Inicio» solo no dice nada.
  if (crumbs.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/">Inicio</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;

          return (
            <Fragment key={`${crumb.label}-${index}`}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : crumb.href === null ? (
                  <span className="inline-flex min-h-(--touch-min) items-center">
                    {crumb.label}
                  </span>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
