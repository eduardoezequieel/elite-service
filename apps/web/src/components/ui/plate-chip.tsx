import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * El chip de placa.
 *
 * La placa es el dato con el que el mostrador y la bahía se entienden: se dice
 * en voz alta, se busca de reojo y se transcribe carácter por carácter. Por eso
 * va en la mono del sistema, en negrita y con la letra abierta —igual que en una
 * matrícula—, dentro de su propia cajita.
 *
 * Se usa en todos lados donde aparezca una placa: la fila, el detalle, la pista
 * y el resumen del alta.
 */
const plateChipVariants = cva(
  'border-line bg-plate-bg text-text inline-block w-fit rounded-[6px] border font-mono font-bold tracking-[0.06em] whitespace-nowrap tabular-nums',
  {
    variants: {
      size: {
        sm: 'px-2 py-0.5 text-[12px]',
        md: 'px-[9px] py-[5px] text-[13.5px]',
        lg: 'px-3 py-1.5 text-[16px]',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
);

type PlateChipSize = NonNullable<VariantProps<typeof plateChipVariants>['size']>;

interface PlateChipProps extends Omit<React.ComponentProps<'span'>, 'children'> {
  /** La placa tal cual la guarda el sistema: `P456-782`. */
  plate: string;
  /** `md` en una fila, `lg` en el título de un detalle, `sm` donde falte sitio. */
  size?: PlateChipSize;
}

function PlateChip({ plate, size = 'md', className, ...props }: PlateChipProps) {
  return (
    <span data-slot="plate-chip" className={cn(plateChipVariants({ size }), className)} {...props}>
      {plate}
    </span>
  );
}

export { PlateChip, plateChipVariants };
export type { PlateChipProps, PlateChipSize };
