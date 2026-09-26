'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * El medidor de carga (067): el isotipo con la aguja barriendo el arco, como un
 * motor que acelera. Es la marca, no una rueda genérica.
 *
 * Va donde no hay forma que anticipar —la pantalla completa, un campo chico, un
 * diálogo—. Donde la forma sí se conoce (una ficha, una lista) van los
 * esqueletos de `skeleton.tsx`, que no hacen saltar la pantalla al terminar.
 *
 * - `md`: en bloque, centrado, con la palabra abajo.
 * - `sm`: en línea, a la altura del texto.
 *
 * Es el isotipo del logo dibujado en vectorial —el logo del taller es una
 * imagen y no se puede animar—; el giro vive en `globals.css` (`elite-sweep`),
 * que `prefers-reduced-motion` deja quieto.
 */
export function GaugeLoader({
  label,
  size = 'md',
  className,
}: {
  /** Qué se está cargando, en español: «Cargando el lavado». Sin puntos suspensivos. */
  label: string;
  size?: 'md' | 'sm';
  className?: string;
}) {
  const gradientId = React.useId();

  return (
    <span
      role="status"
      data-slot="gauge-loader"
      className={cn(
        'text-text-dim inline-flex items-center',
        size === 'md' ? 'flex-col gap-2.5 text-body' : 'gap-2 text-dense',
        className,
      )}
    >
      <svg
        viewBox="0 0 34 26"
        fill="none"
        aria-hidden
        className={cn('shrink-0 overflow-visible', size === 'md' ? 'h-12 w-16' : 'h-4 w-5.5')}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="var(--flame-hot)" />
            <stop offset="0.55" stopColor="var(--flame)" />
            <stop offset="1" stopColor="var(--flame-deep)" />
          </linearGradient>
        </defs>
        <path
          d="M3 22a14 14 0 0 1 28 0"
          stroke={`url(#${gradientId})`}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeDasharray="4.4 3.2"
        />
        <path
          data-slot="gauge-needle"
          d="M17 22 27.5 8.5"
          className="text-text"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="17" cy="22" r="3" className="text-text" fill="currentColor" />
      </svg>
      <span className="font-medium">{label}…</span>
    </span>
  );
}
