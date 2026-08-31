import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * El número de referencia.
 *
 * Ata un objeto a todas las pantallas donde aparece: la misma orden lleva el
 * mismo número en la tabla, en la línea de trabajo y en la línea de repuesto
 * (DESIGN.md → «La Regla del Mismo Número»).
 *
 * Va en la mono del sistema y con almohadilla, para que se lea como folio y no
 * como cantidad. Sin adornos: el número es el vínculo, no una insignia.
 */
const referenceVariants = cva('font-mono text-dense tabular-nums whitespace-nowrap', {
  variants: {
    active: {
      true: 'text-brand',
      false: 'text-muted-foreground',
    },
  },
  defaultVariants: {
    active: false,
  },
});

type ReferenceVariants = VariantProps<typeof referenceVariants>;

interface ReferenceProps extends Omit<React.ComponentProps<'span'>, 'children'> {
  /** El número del objeto. Es el mismo en todas las pantallas donde aparece. */
  value: number;
  /** Marca la referencia como activa o seleccionada. */
  active?: NonNullable<ReferenceVariants['active']>;
}

function Reference({ value, active = false, className, ...props }: ReferenceProps) {
  return (
    <span
      data-slot="reference"
      data-active={active ? '' : undefined}
      className={cn(referenceVariants({ active }), className)}
      {...props}
    >
      #{value}
    </span>
  );
}

export { Reference, referenceVariants };
export type { ReferenceProps };
