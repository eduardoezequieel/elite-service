import type { ReactNode } from 'react';

import { PageBackLink } from '@/components/app-shell/page-back-link';
import { cn } from '@/lib/utils';

/**
 * La cabecera de una pantalla, entera: el enlace de regreso y el nombre a la
 * izquierda, las acciones a la derecha.
 *
 * Es una sola pieza para que todas las pantallas arranquen igual. Antes cada
 * una escribía su propio `<header>` y salían con alturas distintas: la de
 * usuarios reservaba 48px y la de empleados no, así que el título saltaba de
 * sitio al cambiar de pestaña.
 *
 * El regreso se resuelve solo desde la ruta y solo aparece si hay de dónde
 * volver: en una pantalla de primer nivel no se dibuja nada.
 *
 * El alto mínimo se reserva siempre, haya o no botón: sin permiso para crear la
 * franja no se encoge, y el título se queda donde el ojo ya lo buscaba.
 */
export function ScreenHeader({
  title,
  subtitle,
  children,
  className,
}: {
  /**
   * El nombre de la pantalla. Casi siempre texto; la pista titula con la placa,
   * que es su nombre de verdad para el que la mira desde lejos.
   */
  title: ReactNode;
  /** Dato secundario bajo el título: un folio, un recuento. Nunca una acción. */
  subtitle?: ReactNode;
  /** Las acciones de la pantalla, a la derecha. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'mb-6 flex min-h-12 flex-wrap items-end justify-between gap-x-5 gap-y-3',
        className,
      )}
    >
      <div className="min-w-0">
        <PageBackLink className="mb-1" />
        <h1 className="text-display text-text">{title}</h1>
        {subtitle ? <div className="text-text-dim mt-1.5 text-dense">{subtitle}</div> : null}
      </div>

      {children === undefined ? null : (
        <div className="flex flex-wrap items-center gap-2.5">{children}</div>
      )}
    </header>
  );
}
