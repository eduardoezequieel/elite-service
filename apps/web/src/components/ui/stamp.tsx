import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * El sello de estado — componente firma del sistema.
 *
 * Un sello de goma, no una píldora pastel rellena: texto en Label mayúsculas,
 * filete de 1px del color actual, radio 2px y fondo transparente.
 *
 * DESIGN.md → «La Regla del Color Que No Basta»: el sello **siempre** lleva la
 * palabra escrita. Por eso `label` es obligatorio y el componente no acepta
 * hijos: es imposible renderizar un sello mudo.
 *
 * Los cinco tonos salen de los tokens `--stamp-*`, que ya se redefinen en
 * `.dark`; funcionan en claro y en oscuro sin tocar nada.
 */
const stampVariants = cva(
  [
    'inline-flex h-4.5 w-fit shrink-0 items-center justify-center whitespace-nowrap',
    'rounded-sm border border-current bg-transparent px-1.5 py-px',
    'text-label uppercase',
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
  /** La palabra del estado, en español. Se muestra en mayúsculas. */
  label: string;
  /** El tono del sello. Nunca comunica el estado por sí solo. */
  tone?: StampTone;
}

function Stamp({ label, tone = 'neutral', className, ...props }: StampProps) {
  return (
    <span
      data-slot="stamp"
      data-tone={tone}
      className={cn(stampVariants({ tone }), className)}
      {...props}
    >
      {label}
    </span>
  );
}

export { Stamp, stampVariants };
export type { StampProps, StampTone };
