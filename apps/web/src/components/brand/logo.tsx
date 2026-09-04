import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * La marca de Elite Service: el arco segmentado del medidor con la aguja y el
 * punto, más el wordmark «ELITE / SERVICE» en la itálica ancha de Saira.
 *
 * ---
 *
 * **PENDIENTE: el vectorial original del taller.** Este dibujo reconstruye la
 * marca a partir del prototipo aprobado y es lo que se usa hasta que llegue el
 * archivo. Cuando llegue se reemplaza **acá y en ningún otro sitio**: todas las
 * pantallas —login, pista, riel y la referencia de diseño— cuelgan de este
 * componente.
 *
 * El degradado del arco se define con `<linearGradient>` sobre `var(--flame-*)`,
 * así que respeta los tokens del tema y no escribe ningún color propio.
 */
export interface LogoProps extends Omit<React.ComponentProps<'span'>, 'children'> {
  /** `mark` es solo el arco; `full` le agrega el wordmark. */
  variant?: 'mark' | 'full';
  /** Alto del arco en píxeles. El wordmark escala con él. */
  size?: number;
}

/** Proporción del dibujo del arco: 34 × 26. */
const MARK_RATIO = 34 / 26;

export function Logo({ variant = 'full', size = 26, className, ...props }: LogoProps) {
  const gradientId = React.useId();
  const width = Math.round(size * MARK_RATIO);

  return (
    <span
      data-slot="logo"
      className={cn('inline-flex items-center gap-[11px]', className)}
      {...props}
    >
      <svg
        width={width}
        height={size}
        viewBox="0 0 34 26"
        fill="none"
        role="img"
        aria-label={variant === 'full' ? 'Elite Service' : 'Elite Service, isotipo'}
        className="shrink-0"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="var(--flame-hot)" />
            <stop offset="0.55" stopColor="var(--flame)" />
            <stop offset="1" stopColor="var(--flame-deep)" />
          </linearGradient>
        </defs>

        {/* El arco del medidor, partido en tirones cortos. */}
        <path
          d="M3 22a14 14 0 0 1 28 0"
          stroke={`url(#${gradientId})`}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeDasharray="4.4 3.2"
        />
        {/* La aguja y su eje, en el color del texto de quien lo aloje. */}
        <path d="M17 22 27.5 8.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="17" cy="22" r="3" fill="currentColor" />
      </svg>

      {variant === 'full' ? (
        <span aria-hidden className="font-display leading-none font-extrabold italic">
          <span className="block" style={{ fontSize: `${size * 0.73}px` }}>
            ELITE
          </span>
          {/* El subtítulo se apoya en `--logo-sub` para que el riel —azul marino
              en los dos temas— lo pinte con su propio tenue sin tocar el resto. */}
          <span
            className="block font-semibold text-[color:var(--logo-sub,var(--text-faint))] not-italic tracking-[0.22em]"
            style={{ fontSize: `${size * 0.4}px` }}
          >
            SERVICE
          </span>
        </span>
      ) : null}
    </span>
  );
}
