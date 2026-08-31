import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * El sello de estado — componente firma del sistema.
 *
 * Relleno suave: el propio tono al 10% como fondo, al 25% en el filete, y el
 * tono pleno como texto. La utilidad `.tint` de `globals.css` deriva las tres
 * cosas de `currentColor`, así que cada tono se resuelve con una sola clase y
 * funciona igual en claro y en oscuro.
 *
 * DESIGN.md → «La Regla del Color Que No Basta»: el sello **siempre** lleva la
 * palabra escrita. Por eso `label` es obligatorio y el componente no acepta
 * hijos: es imposible renderizar un sello mudo.
 */
const stampVariants = cva(
  [
    'tint inline-flex h-5.5 w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap',
    'rounded-full border px-2 text-label',
  ],
  {
    variants: {
      tone: {
        /** Recibido, en espera, neutro. */
        neutral: 'text-stamp-neutral',
        /** En proceso, requiere atención. */
        amber: 'text-stamp-amber',
        /** Listo, aprobado, pagado. */
        green: 'text-stamp-green',
        /** Vencido, rechazado, detenido. */
        red: 'text-stamp-red',
        /** Informativo, programado. */
        blue: 'text-stamp-blue',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
);

type StampTone = NonNullable<VariantProps<typeof stampVariants>['tone']>;

interface StampProps extends Omit<React.ComponentProps<'span'>, 'children'> {
  /** La palabra del estado, en español y en caja normal: «En diagnóstico». */
  label: string;
  /** El tono del sello. Nunca comunica el estado por sí solo. */
  tone?: StampTone;
  /** Icono opcional de `lucide-react`, a la izquierda de la palabra. */
  icon?: React.ReactNode;
}

function Stamp({ label, tone = 'neutral', icon, className, ...props }: StampProps) {
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
      ) : null}
      {label}
    </span>
  );
}

export { Stamp, stampVariants };
export type { StampProps, StampTone };
