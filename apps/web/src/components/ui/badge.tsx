import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';

import { cn } from '@/lib/utils';

/**
 * Componente auxiliar. El estado del sistema se comunica con un sello (`<Stamp>`),
 * así que el badge nunca lleva relleno saturado: filete de 1px del color actual,
 * radio 2px y texto en Label mayúsculas.
 */
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border border-current bg-transparent px-1.5 py-px text-label uppercase whitespace-nowrap transition-colors duration-(--duration-state) ease-standard aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'text-foreground [a&]:hover:bg-accent',
        secondary: 'text-muted-foreground [a&]:hover:bg-accent',
        destructive: 'text-destructive [a&]:hover:bg-destructive/10',
        outline: 'border-border text-foreground [a&]:hover:bg-accent',
        ghost: 'border-transparent text-muted-foreground [a&]:hover:bg-accent',
        link: 'border-transparent text-foreground underline-offset-4 [a&]:hover:underline',
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
