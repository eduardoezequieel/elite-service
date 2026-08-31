import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';

import { cn } from '@/lib/utils';

/**
 * Botón del sistema «El Catálogo de Piezas».
 *
 * Esquina suave (`rounded-md`, 8px), alto desde `--control-h`, texto en Cuerpo de peso
 * medio y caja normal — nada de mayúsculas forzadas — y cero sombras: la profundidad se
 * da con relleno y filete de 1px. El anillo de foco lo pone `:focus-visible` en
 * globals.css, por eso acá no hay ninguna clase de anillo.
 *
 * **Deshabilitado sin opacidad** (spec 003 → RN-2): el botón pasa a relleno Lavado con
 * texto Grafito y cursor de no permitido. Bajar la opacidad se lee como un fallo de
 * pintado, y la trama de 45° es de superficies y campos, nunca de un botón. Lo que el
 * usuario no tiene permiso de hacer no se deshabilita: no se renderiza.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-body font-medium whitespace-nowrap transition-colors duration-(--duration-state) ease-standard disabled:cursor-not-allowed disabled:border-transparent disabled:bg-secondary disabled:text-muted-foreground disabled:hover:bg-secondary disabled:hover:text-muted-foreground aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-icon",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary)_90%,var(--foreground))]',
        destructive: 'tint border text-destructive hover:[--tint-fill:16%]',
        destructiveSolid:
          'bg-destructive text-destructive-foreground hover:bg-[color-mix(in_oklch,var(--destructive)_90%,var(--foreground))]',
        outline: 'border border-rule bg-transparent text-foreground hover:bg-accent',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary)_92%,var(--foreground))]',
        ghost: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        link: 'text-foreground underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-control px-4 has-[>svg]:px-3',
        xs: 'h-[calc(var(--control-h)_-_8px)] gap-1 px-2 has-[>svg]:px-1.5',
        sm: 'h-[calc(var(--control-h)_-_4px)] gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-[calc(var(--control-h)_+_8px)] px-6 has-[>svg]:px-4',
        icon: 'size-control',
        'icon-xs': 'size-[calc(var(--control-h)_-_8px)]',
        'icon-sm': 'size-[calc(var(--control-h)_-_4px)]',
        'icon-lg': 'size-[calc(var(--control-h)_+_8px)]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
