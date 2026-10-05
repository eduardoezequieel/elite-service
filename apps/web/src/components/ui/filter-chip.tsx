'use client';

import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Un chip de filtro en píldora (106): «Todas 4», «Trabajadores 3», «Bebidas».
 * Uno de un grupo queda elegido —`aria-pressed` y el filete de llama—, así que
 * el estado no depende solo del color. Mide `--touch-min`: en la bahía sube
 * solo a 44px y gana aire a los lados.
 *
 * Sirve también de atajo («Todo · $3.75»): sin `pressed`, es un botón más.
 */
export function FilterChip({
  pressed,
  count,
  children,
  className,
  ...props
}: Omit<ComponentProps<'button'>, 'type' | 'aria-pressed'> & {
  /** Elegido en su grupo. Sin esto, el chip es un atajo y no dice estado. */
  pressed?: boolean;
  /** El conteo tenue al lado de la palabra. */
  count?: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        'inline-flex min-h-(--touch-min) shrink-0 cursor-pointer items-center gap-2 rounded-full border-(length:--selectable-border) px-3.5 text-dense font-semibold',
        'transition-[border-color,background-color,color] duration-(--duration-state) ease-standard',
        'disabled:cursor-not-allowed disabled:opacity-55',
        '[[data-density=bahia]_&]:px-5 [[data-density=bahia]_&]:text-body',
        pressed === true
          ? 'border-flame bg-surface-2 text-text'
          : 'border-line bg-surface text-text-dim hover:border-text-faint hover:text-text',
        className,
      )}
      {...props}
    >
      {children}
      {count === undefined ? null : (
        <span className="text-text-faint text-label font-medium tabular-nums">{count}</span>
      )}
    </button>
  );
}
