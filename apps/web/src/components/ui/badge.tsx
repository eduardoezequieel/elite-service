import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';

import { cn } from '@/lib/utils';

/**
 * Componente auxiliar. El estado del sistema se comunica con un sello (`<Stamp>`), así
 * que el badge habla el mismo idioma que él: relleno suave con `.tint` — el tono al 10%
 * de fondo y al 25% en el filete, el tono pleno como texto —, forma de píldora y Label
 * en caja normal. Nunca relleno saturado.
 */
const badgeVariants = cva(
  'tint inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2 py-px text-label whitespace-nowrap transition-colors duration-(--duration-state) ease-standard aria-invalid:border-danger [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'text-text [a&]:hover:[--tint-fill:18%]',
        secondary: 'text-text-dim [a&]:hover:[--tint-fill:18%]',
        destructive: 'text-danger-text [a&]:hover:[--tint-fill:18%]',
        outline: 'border-line bg-transparent text-text [a&]:hover:bg-surface-2',
        ghost: 'border-transparent bg-transparent text-text-dim [a&]:hover:bg-surface-2',
        link: 'border-transparent bg-transparent text-text underline-offset-4 [a&]:hover:underline',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span';

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
