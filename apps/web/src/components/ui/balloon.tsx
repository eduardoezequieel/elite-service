'use client';

import * as React from 'react';
import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * El globo de referencia — componente firma del sistema.
 *
 * Un círculo con un número dentro que ata un objeto a todas las pantallas donde
 * aparece: la misma orden lleva el mismo número en la tabla, en la línea de
 * trabajo y en la línea de repuesto (DESIGN.md → «La Regla del Mismo Número»).
 *
 * El tamaño sale siempre del token de densidad `--balloon-size`, expuesto en
 * Tailwind como `size-balloon`: 20px en `mostrador`, 26px en `bahia`.
 */

/**
 * Duración del pulso único al llegar por referencia cruzada (DESIGN.md: 140ms).
 * El filete sube a 2px y vuelve a 1.5px; la transición usa `--duration-state`.
 */
const PULSE_DURATION_MS = 140;

const balloonVariants = cva(
  [
    'inline-flex size-balloon shrink-0 select-none items-center justify-center',
    'rounded-full border-solid bg-card text-label tabular-nums',
    'transition-[color,border-color,border-width] ease-standard duration-[var(--duration-state)]',
  ],
  {
    variants: {
      /** Activo o seleccionado: filete y cifra en Naranja Elite. */
      active: {
        true: 'border-brand text-brand',
        false: 'border-foreground text-foreground',
      },
      /** Cuadro alto del pulso: el filete engorda de 1.5px a 2px. */
      pulsing: {
        true: 'border-2',
        false: 'border-[1.5px]',
      },
    },
    defaultVariants: {
      active: false,
      pulsing: false,
    },
  },
);

interface BalloonProps extends Omit<React.ComponentProps<'span'>, 'children'> {
  /** El número del objeto. Es el mismo en todas las pantallas donde aparece. */
  reference: number;
  /** Marca el globo como activo o seleccionado. */
  active?: boolean;
  /** Se llegó a este globo siguiendo una referencia cruzada: pulsa una sola vez. */
  pulse?: boolean;
}

function Balloon({
  reference,
  active = false,
  pulse = false,
  className,
  'aria-label': ariaLabel,
  ...props
}: BalloonProps) {
  const [pulsing, setPulsing] = React.useState(false);

  React.useEffect(() => {
    if (!pulse) return;

    // La Regla del Movimiento Respetuoso: si el usuario pide menos animación, no animamos.
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

    setPulsing(true);
    const timer = window.setTimeout(() => setPulsing(false), PULSE_DURATION_MS);

    return () => {
      window.clearTimeout(timer);
      setPulsing(false);
    };
  }, [pulse]);

  return (
    <span
      data-slot="balloon"
      data-active={active ? '' : undefined}
      data-pulsing={pulsing ? '' : undefined}
      role="img"
      aria-label={ariaLabel ?? `Referencia ${reference}`}
      className={cn(balloonVariants({ active, pulsing }), className)}
      {...props}
    >
      {reference}
    </span>
  );
}

export { Balloon, balloonVariants };
export type { BalloonProps };
