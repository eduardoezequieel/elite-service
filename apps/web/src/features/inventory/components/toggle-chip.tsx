'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Un filtro que se prende y se apaga («Bajo mínimo», «Ver inactivos»). Misma
 * altura y piel que el botón Filtros, `aria-pressed` de verdad y el punto que
 * se llena al prenderse: el estado no depende solo del color del filete.
 */
export function ToggleChip({
  pressed,
  onPressedChange,
  tone = 'neutral',
  children,
}: {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  /** `danger` pinta el punto de rojo: el filtro de lo que está bajo el mínimo. */
  tone?: 'neutral' | 'danger';
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        'border-line bg-surface-2 text-text inline-flex shrink-0 items-center justify-center gap-2 self-stretch rounded-control border px-4 text-body font-semibold',
        'min-h-(--touch-min) transition-colors duration-(--duration-state) ease-standard hover:border-flame',
        '[[data-density=bahia]_&]:px-5',
        pressed ? 'border-flame' : 'text-text-dim',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-2 shrink-0 rounded-full border',
          tone === 'danger' ? 'border-danger-text' : 'border-text-dim',
          pressed && (tone === 'danger' ? 'bg-danger-text' : 'bg-text'),
        )}
      />
      {children}
    </button>
  );
}
