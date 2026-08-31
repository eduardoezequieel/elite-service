import * as React from 'react';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { Slot } from 'radix-ui';

import { cn } from '@/lib/utils';

/**
 * Primitivas del rastro de migas (DESIGN.md → Navigation → El rastro de migas).
 *
 * Generado por shadcn/ui y realineado al sistema: texto en Label de 12px en caja
 * normal, tono Grafito, la pantalla actual en Tinta con peso 600 y área táctil de
 * `--touch-min` en cada enlace. Sin fondo, sin caja y sin sombra: es una línea de
 * texto, no una barra.
 */
function Breadcrumb({ ...props }: React.ComponentProps<'nav'>) {
  return <nav aria-label="Ruta" data-slot="breadcrumb" {...props} />;
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<'ol'>) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn(
        'text-label text-muted-foreground flex flex-wrap items-center gap-1.5 font-normal break-words',
        className,
      )}
      {...props}
    />
  );
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn('inline-flex items-center gap-1.5', className)}
      {...props}
    />
  );
}

function BreadcrumbLink({
  asChild,
  className,
  ...props
}: React.ComponentProps<'a'> & {
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot.Root : 'a';

  return (
    <Comp
      data-slot="breadcrumb-link"
      className={cn(
        'hover:text-foreground inline-flex min-h-(--touch-min) items-center rounded-md transition-colors duration-(--duration-state) ease-standard',
        className,
      )}
      {...props}
    />
  );
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn(
        'text-foreground inline-flex min-h-(--touch-min) items-center font-semibold',
        className,
      )}
      {...props}
    />
  );
}

function BreadcrumbSeparator({ children, className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn('text-muted-foreground [&>svg]:size-3.5', className)}
      {...props}
    >
      {children ?? <ChevronRight strokeWidth={1.5} />}
    </li>
  );
}

function BreadcrumbEllipsis({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      className={cn('flex size-control items-center justify-center', className)}
      {...props}
    >
      <MoreHorizontal className="size-icon" strokeWidth={1.5} />
      <span className="sr-only">Más</span>
    </span>
  );
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
};
