import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Un grupo de campos dentro de un diálogo largo de la rentadora (095): título
 * en `text-title` con filete, y los campos en dos columnas en escritorio. En
 * densidad `bahia` y bajo 640px van en una sola, que es como se llenan con el
 * dedo.
 */
export function FormSection({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex flex-col gap-3', className)}>
      <div className="border-line-soft border-b pb-2">
        <h3 className="text-title text-text">{title}</h3>
        {hint === undefined ? null : <p className="text-text-faint text-dense">{hint}</p>}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
        {children}
      </div>
    </section>
  );
}
