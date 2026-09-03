'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { backLinkFor } from '@/components/app-shell/back-link';
import { cn } from '@/lib/utils';

/**
 * La salida de una pantalla hija (DESIGN.md → Enlace de regreso).
 *
 * Vive dentro de la cabecera de pantalla, pegado encima del título, y dice a
 * dónde lleva: flecha a la izquierda y el nombre del padre. No es una barra
 * superior ni un rastro de migas —antes lo era, y con un árbol de un solo nivel
 * eso se reducía a una miga de 12px en el gris más tenue: el usuario no la veía
 * y se quedaba encerrado en la ficha—.
 *
 * En una pantalla de primer nivel no dibuja nada: el riel ya dice dónde estás.
 */
export function PageBackLink({ className }: { className?: string }) {
  const pathname = usePathname();
  const target = backLinkFor(pathname);

  if (target === null) return null;

  return (
    <Link
      data-slot="back-link"
      href={target.href}
      // El `-ml-1` compensa el aire propio del chevron: lo que alinea con el
      // título es el texto, no la caja del icono.
      className={cn(
        'text-text-dim hover:text-text -ml-1 inline-flex min-h-(--touch-min) items-center gap-1 text-dense transition-colors duration-(--duration-state) ease-standard',
        className,
      )}
    >
      <ChevronLeft aria-hidden className="size-icon" strokeWidth={1.5} />
      {target.label}
    </Link>
  );
}
