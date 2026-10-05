'use client';

import type { TabHolderOption } from '@elite/shared';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { HolderAvatar } from './holder-avatar';

/**
 * Una persona en un selector de titular (106): iniciales, nombre, placa o
 * teléfono si es cliente y, a la derecha, lo que ya debe (`aside`). La usan el
 * flotante de «Nueva venta» y la lista de «Abrir cuenta». Mide `--touch-min`
 * y en la bahía el nombre sube de tamaño.
 */
export function HolderOptionRow({
  holder,
  active = false,
  selected = false,
  aside,
  className,
  ...props
}: Omit<ComponentProps<'button'>, 'type' | 'children'> & {
  holder: TabHolderOption;
  /** Marcada con el teclado o con el puntero. */
  active?: boolean;
  /** La elegida: filete de llama, además del fondo. */
  selected?: boolean;
  aside?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex min-h-touch w-full cursor-pointer items-center gap-3 rounded-control border px-3 py-2 text-left',
        'transition-colors duration-(--duration-state) ease-standard hover:bg-surface-2',
        '[[data-density=bahia]_&]:py-2.5',
        selected ? 'border-flame bg-surface-2' : 'border-transparent',
        active && 'bg-surface-2',
        className,
      )}
      {...props}
    >
      <HolderAvatar name={holder.fullName} size="sm" on={selected} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-text truncate font-semibold [[data-density=bahia]_&]:text-title">
          {holder.fullName}
        </span>
        {holder.detail === null ? null : (
          <span className="text-text-faint truncate text-dense">{holder.detail}</span>
        )}
      </span>
      {aside}
    </button>
  );
}

/** El rótulo de un grupo del selector: «Trabajadores», «Clientes». */
export function HolderGroupLabel({ children }: { children: ReactNode }) {
  return <p className="text-text-faint mx-3 mt-2 mb-0.5 text-label first:mt-0.5">{children}</p>;
}
