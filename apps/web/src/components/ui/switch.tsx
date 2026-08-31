'use client';

import * as React from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

/**
 * Interruptor del sistema «El Catálogo de Piezas».
 *
 * Píldora (`rounded-full`) con la perilla también redonda, sin sombra: encendido se
 * rellena en `--primary` con la perilla en `--primary-foreground`; apagado usa el
 * neutro suave (`--secondary`) con la perilla en Grafito. La perilla toma su color de
 * `currentColor`, así que el estado se decide con una sola clase de texto.
 *
 * El área táctil llega a `--touch-min` (32px en `mostrador`, 44px en `bahia`) con un
 * `::before` centrado, sin agrandar la píldora visible.
 *
 * El anillo de foco lo pone `:focus-visible` en globals.css; acá no hay clases de anillo.
 */
function Switch({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: 'sm' | 'default';
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        'peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent p-0.5 transition-colors duration-(--duration-state) ease-standard',
        'data-[size=default]:h-5 data-[size=default]:w-9 data-[size=sm]:h-4 data-[size=sm]:w-7',
        // Objetivo táctil: 32×32 en mostrador, 44×44 en bahía. No cambia el dibujo.
        "before:absolute before:top-1/2 before:left-1/2 before:size-(--touch-min) before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']",
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-destructive',
        'data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
        'data-[state=unchecked]:bg-secondary data-[state=unchecked]:text-muted-foreground',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none relative block rounded-full bg-current transition-transform duration-(--duration-state) ease-standard',
          'group-data-[size=default]/switch:size-3.5 group-data-[size=sm]/switch:size-2.5',
          'data-[state=unchecked]:translate-x-0',
          'group-data-[size=default]/switch:data-[state=checked]:translate-x-4 group-data-[size=sm]/switch:data-[state=checked]:translate-x-3',
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
