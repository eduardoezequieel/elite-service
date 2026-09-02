'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { breadcrumbTrailFor } from '@/components/app-shell/breadcrumbs';

/**
 * Rastro de ficha sobre el título (DESIGN.md → Breadcrumb).
 *
 * No es una barra global: vive dentro de la cabecera de lámina, pegado encima
 * del título, en Label y caja normal. Todos sus tramos son ancestros y por lo
 * tanto enlaces —Grafito en reposo, Tinta al pasar—, con área táctil
 * `--touch-min` en `bahía`. El chevron no es un control.
 *
 * En una pantalla de primer nivel no dibuja nada: el riel ya dice dónde estás.
 */
export function PageBreadcrumb({ className }: { className?: string }) {
  const pathname = usePathname();
  const trail = breadcrumbTrailFor(pathname);

  if (trail.length === 0) return null;

  return (
    <nav aria-label="Ruta" className={className}>
      <ol className="flex flex-wrap items-center gap-x-1 text-label">
        {trail.map((crumb, index) => (
          <li key={crumb.href} className="flex items-center gap-x-1">
            {index > 0 ? (
              <ChevronRight aria-hidden className="size-icon text-text-faint" strokeWidth={1.5} />
            ) : null}

            <Link
              href={crumb.href}
              className="text-text-faint hover:text-text inline-flex min-h-(--touch-min) items-center transition-colors duration-(--duration-state) ease-standard"
            >
              {crumb.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
