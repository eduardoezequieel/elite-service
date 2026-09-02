import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * El chip de estado — componente firma del sistema.
 *
 * Punto de color + palabra, en píldora con relleno suave: el propio tono al 12%
 * como fondo, al 40% en el filete y pleno como texto. La utilidad `.tint` de
 * `globals.css` deriva las tres cosas de `currentColor`, así que cada tono se
 * resuelve con una sola clase y funciona igual en claro y en oscuro.
 *
 * DESIGN.md → «El estado nunca se comunica solo con color»: el chip **siempre**
 * lleva la palabra escrita. Por eso `label` es obligatorio y el componente no
 * acepta hijos: es imposible renderizar un chip mudo.
 *
 * Los cinco tonos históricos (`neutral`, `amber`, `green`, `red`, `blue`) siguen
 * existiendo y ahora apuntan a la paleta nueva; los cinco del ciclo de un lavado
 * (`queue`, `washing`, `ready`, `paid`, `void`) se agregaron al lado.
 */
const stampVariants = cva(
  [
    'tint inline-flex w-fit shrink-0 items-center justify-center gap-[7px] whitespace-nowrap',
    'rounded-full border px-[11px] py-[5px] text-dense font-semibold',
  ],
  {
    variants: {
      tone: {
        /* --- Los cinco tonos históricos --- */
        /** Recibido, en espera, neutro. */
        neutral: 'text-text-dim',
        /** En proceso, requiere atención. */
        amber: 'text-warn-text',
        /** Listo, aprobado, pagado. */
        green: 'text-go-text',
        /** Vencido, rechazado, detenido. */
        red: 'text-danger-text',
        /** Informativo, programado. */
        blue: 'text-text-dim',

        /* --- El ciclo de un lavado --- */
        /** En cola: todavía nadie lo tocó. */
        queue: 'text-text-dim',
        /** Lavando: el único chip que late. */
        washing: 'text-flame-text',
        /** Listo para cobrar. */
        ready: 'text-go-text',
        /** Cobrado: cerrado en bien, así que se apaga. */
        paid: 'text-text-faint',
        /** Anulado. */
        void: 'text-danger-text',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
);

type StampTone = NonNullable<VariantProps<typeof stampVariants>['tone']>;

/** El único tono que late por su cuenta: algo está pasando ahora mismo. */
const PULSING_TONES: readonly StampTone[] = ['washing'];

interface StampProps extends Omit<React.ComponentProps<'span'>, 'children'> {
  /** La palabra del estado, en español y en caja normal: «Listo». */
  label: string;
  /** El tono del chip. Nunca comunica el estado por sí solo. */
  tone?: StampTone;
  /** Icono opcional de `lucide-react`, en lugar del punto. */
  icon?: React.ReactNode;
  /**
   * Fuerza el latido del punto, o lo apaga. Por defecto late solo el tono
   * `washing`. `prefers-reduced-motion` lo apaga siempre.
   */
  pulse?: boolean;
}

function Stamp({ label, tone = 'neutral', icon, pulse, className, ...props }: StampProps) {
  const beats = pulse ?? PULSING_TONES.includes(tone);

  return (
    <span
      data-slot="stamp"
      data-tone={tone}
      className={cn(stampVariants({ tone }), className)}
      {...props}
    >
      {icon ? (
        <span aria-hidden className="flex shrink-0 items-center [&_svg]:size-3.5">
          {icon}
        </span>
      ) : (
        <span
          aria-hidden
          data-slot="stamp-dot"
          className={cn(
            'size-1.5 shrink-0 rounded-full bg-current',
            beats && 'animate-[elite-pulse_1.6s_ease-in-out_infinite]',
          )}
        />
      )}
      {label}
    </span>
  );
}

export { Stamp, stampVariants };
export type { StampProps, StampTone };
