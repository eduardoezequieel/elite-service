import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * El arco del medidor, insinuado detrás de la tarjeta de entrada.
 *
 * Es el mismo trazo del `<SegmentGauge>` y del logo, ampliado y bajado a un
 * filete tenue: le da fondo a las dos pantallas de entrada sin competir con la
 * tarjeta. No dice nada —es decoración pura, `aria-hidden`— y no se mueve: el
 * movimiento del sistema solo responde a una acción.
 */
export function GaugeBackdrop({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      aria-hidden
      data-slot="gauge-backdrop"
      className={cn(
        'pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center overflow-hidden',
        className,
      )}
      {...props}
    >
      <svg
        width="860"
        height="520"
        viewBox="0 0 96 58"
        fill="none"
        focusable="false"
        className="max-w-none opacity-40"
      >
        <path
          d="M10 50a38 38 0 0 1 76 0"
          stroke="var(--line)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeDasharray="5 4.5"
        />
      </svg>
    </div>
  );
}
