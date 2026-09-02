import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * El medidor de segmentos.
 *
 * Un arco partido en tirones cortos, con la pista en `--line` y el tramo
 * recorrido en el degradado de llama, y la cifra encima en Saira itálica. Es el
 * único gesto de tablero que el sistema se permite, y viene del arco del logo.
 *
 * Sirve **solo** para «X de Y»: una cuenta contra un techo real. No es una barra
 * de progreso de tiempo ni un adorno.
 *
 * No tiene animación de entrada: el número ya está ahí cuando la pantalla pinta.
 */
export interface SegmentGaugeProps extends Omit<React.ComponentProps<'div'>, 'children'> {
  /** Cuánto se lleva. */
  value: number;
  /** El techo. Si es 0 el arco queda vacío, sin romperse. */
  max: number;
  /** Qué se está contando: se usa en el `aria-label` («Cobrados: 11 de 18»). */
  label?: string;
}

/**
 * Cada `<SegmentGauge>` necesita su propio `<linearGradient>`: dos `id` iguales
 * en la misma página se pisan. `useId` los mantiene únicos y estables entre
 * servidor y cliente.
 */
export function SegmentGauge({ value, max, label, className, ...props }: SegmentGaugeProps) {
  const gradientId = React.useId();
  const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  // `pathLength=100` normaliza el arco: el tramo pintado es el porcentaje justo,
  // sin tener que medir la curva.
  const drawn = ratio * 100;

  const reading = `${label === undefined ? '' : `${label}: `}${value} de ${max}`;

  return (
    <div
      data-slot="segment-gauge"
      className={cn('relative w-24 shrink-0', className)}
      role="img"
      aria-label={reading}
      {...props}
    >
      <svg width="96" height="58" viewBox="0 0 96 58" fill="none" aria-hidden focusable="false">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="var(--flame-hot)" />
            <stop offset="0.6" stopColor="var(--flame)" />
            <stop offset="1" stopColor="var(--flame-deep)" />
          </linearGradient>
        </defs>

        <path
          d="M10 50a38 38 0 0 1 76 0"
          stroke="var(--line)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray="5 4.5"
        />
        {drawn > 0 ? (
          <path
            d="M10 50a38 38 0 0 1 76 0"
            stroke={`url(#${gradientId})`}
            strokeWidth="7"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${drawn} 100`}
          />
        ) : null}
      </svg>

      <span
        aria-hidden
        className="text-text font-display absolute inset-x-0 bottom-0.5 text-center text-[19px] leading-none font-bold italic tabular-nums"
      >
        {value}
      </span>
    </div>
  );
}
