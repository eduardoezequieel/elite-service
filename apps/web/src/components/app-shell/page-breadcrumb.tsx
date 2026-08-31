'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { breadcrumbTrailFor } from '@/components/app-shell/breadcrumbs';
import { cn } from '@/lib/utils';

/**
 * Rastro de ficha sobre el título (DESIGN.md → Breadcrumb).
 *
 * No es una barra global: vive en el contenido, en Label, caja normal. Los
 * tramos anteriores van en Grafito; el actual en Tinta y peso 600. El chevron
 * no es un control. Un enlace cumple `--touch-min` en `bahía`.
 */
export function PageBreadcrumb({ className }: { className?: string }) {
  const pathname = usePathname();
  const trail = breadcrumbTrailFor(pathname);

  if (trail === null || trail.length === 0) return null;

  const lastIndex = trail.length - 1;

  return (
    <nav aria-label="Ruta" className={cn('mb-3', className)}>
      <ol className="flex flex-wrap items-center gap-x-1 text-label">
        {trail.map((crumb, index) => {
          const isCurrent = index === lastIndex;

          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-x-1">
              {index > 0 ? (
                <ChevronRight
                  aria-hidden
                  className="size-icon text-muted-foreground"
                  strokeWidth={1.5}
                />
              ) : null}

              {isCurrent ? (
                <span aria-current="page" className="font-semibold text-foreground">
                  {crumb.label}
                </span>
              ) : crumb.href ? (
                <Link
                  href={crumb.href}
                  className="inline-flex min-h-(--touch-min) items-center text-muted-foreground transition-colors duration-(--duration-state) ease-standard hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-muted-foreground">{crumb.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
