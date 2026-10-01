import type { LucideIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * El estado vacío.
 *
 * Nunca «No hay datos» a secas: un título que dice cómo se llama el vacío, una
 * frase que explica **qué va a aparecer acá** cuando el trabajo empiece, y —si
 * el usuario tiene permiso— el botón que lo llena.
 *
 * Borde punteado a propósito: dice «acá falta algo» en vez de fingir una
 * tarjeta llena.
 */
export interface EmptyStateProps extends React.ComponentProps<'div'> {
  /** Cómo se llama el vacío: «Nada por aquí todavía». */
  title: string;
  /** Qué va a aparecer cuando haya algo. */
  description?: React.ReactNode;
  /** El botón que llena la lista. Solo si el usuario puede. */
  action?: React.ReactNode;
  /** Icono del módulo sobre el título, en `--text-faint`. Nunca una ilustración. */
  icon?: LucideIcon;
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'border-line bg-surface text-text-dim flex flex-col items-center gap-1.5 rounded-row border border-dashed px-6 py-11 text-center text-body',
        className,
      )}
      {...props}
    >
      {Icon ? (
        <Icon className="size-icon text-text-faint mb-1" strokeWidth={1.5} aria-hidden />
      ) : null}
      <b className="text-text text-(length:--lead-size) font-semibold">{title}</b>
      {description ? <p className="m-0 max-w-[52ch]">{description}</p> : null}
      {action ? <div className="mt-3 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
