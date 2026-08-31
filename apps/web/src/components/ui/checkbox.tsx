'use client';

import * as React from 'react';
import { CheckIcon } from 'lucide-react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

/**
 * Casilla del sistema «El Catálogo de Piezas».
 *
 * Dibujo chico y plano: esquina `rounded-sm` (6px), fondo Lámina, filete de 1px y cero
 * sombras. Marcada se rellena en `--primary` con la tinta `--primary-foreground`.
 *
 * El área táctil no es el dibujo: un `::before` centrado la lleva a `--touch-min`
 * (32px en `mostrador`, 44px en `bahia`) sin agrandar la casilla visible.
 *
 * El anillo de foco lo pone `:focus-visible` en globals.css; por eso acá no hay
 * ninguna clase de anillo.
 */
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer relative size-4 shrink-0 rounded-sm border border-input bg-card transition-colors duration-(--duration-state) ease-standard',
        // Objetivo táctil: 32×32 en mostrador, 44×44 en bahía. No cambia el dibujo.
        "before:absolute before:top-1/2 before:left-1/2 before:size-(--touch-min) before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']",
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-destructive',
        'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="relative grid place-content-center text-current transition-none"
      >
        <CheckIcon className="size-3.5" strokeWidth={1.5} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
