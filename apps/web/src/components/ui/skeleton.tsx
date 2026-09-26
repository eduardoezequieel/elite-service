import type * as React from 'react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Un bloque de espera con la forma de lo que viene (067). El brillo que lo
 * cruza vive en `globals.css` (`elite-shimmer`) y se apaga con
 * `prefers-reduced-motion`. Mudo: quien lo arma anuncia la carga una vez.
 */
export function Skeleton({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      aria-hidden
      data-slot="skeleton"
      className={cn('bg-surface-3 relative block h-3 overflow-hidden rounded-[6px]', className)}
      {...props}
    />
  );
}

/** Anchos que se alternan para que las filas no parezcan copiadas. */
const ROW_WIDTHS = ['w-[46%]', 'w-[34%]', 'w-[58%]', 'w-[40%]', 'w-[52%]'] as const;

/**
 * Filas de una lista mientras carga, al alto de `--row-h`, igual que la lista
 * real en las dos densidades. `bare` las deja sin tarjeta, para meterlas en una
 * que ya existe (la línea de tiempo).
 */
export function ListSkeleton({
  rows = 5,
  label = 'Cargando la lista',
  bare = false,
  className,
}: {
  rows?: number;
  label?: string;
  bare?: boolean;
  className?: string;
}) {
  const body = Array.from({ length: rows }, (_, index) => (
    <div
      key={index}
      className="border-line-soft min-h-row flex items-center justify-between gap-3 border-b last:border-b-0"
    >
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <Skeleton className="h-6.5 w-20 shrink-0" />
        <Skeleton className={ROW_WIDTHS[index % ROW_WIDTHS.length]} />
      </span>
      <Skeleton className="h-7 w-20 rounded-full" />
    </div>
  ));

  if (bare) {
    return (
      <div role="status" aria-label={label} className={cn('flex flex-col', className)}>
        {body}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        'border-line-soft bg-surface rounded-row flex flex-col border px-4.5',
        className,
      )}
    >
      {body}
    </div>
  );
}

/**
 * Una ficha mientras carga: cabecera con título y chip, y dos tarjetas. No
 * copia ninguna ficha en particular; alcanza con que ocupe el mismo lugar.
 */
export function DetailSkeleton({
  label = 'Cargando',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div role="status" aria-label={label} className={cn('flex flex-col gap-4', className)}>
      <div className="mb-2 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-24 rounded-[8px]" />
          <Skeleton className="h-7.5 w-28 rounded-full" />
        </div>
        <Skeleton className="w-40" />
      </div>

      <Card className="gap-3 px-card">
        <Skeleton className="h-8.5 w-32" />
        <Skeleton className="w-3/5" />
        <Skeleton className="w-2/5" />
      </Card>

      <Card className="gap-0 px-card">
        <div className="border-line-soft min-h-row flex items-center justify-between gap-3 border-b">
          <Skeleton className="w-[45%]" />
          <Skeleton className="w-12" />
        </div>
        <div className="min-h-row flex items-center justify-between gap-3">
          <Skeleton className="w-[30%]" />
          <Skeleton className="h-6 w-20" />
        </div>
      </Card>
    </div>
  );
}
