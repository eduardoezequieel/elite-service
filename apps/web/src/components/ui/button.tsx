import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { Slot } from 'radix-ui';

import { cn } from '@/lib/utils';

/**
 * Botón del sistema.
 *
 * `default` es el único primario: el degradado de llama con texto blanco y una
 * sombra baja del mismo naranja. `outline` y `secondary` son el fantasma —
 * superficie 2 con filete `--line`, que pasa a `--flame` al pasar el mouse—.
 * `destructive` es el peligro en relleno suave y `destructiveSolid` el rojo
 * lleno, reservado al diálogo de confirmación.
 *
 * Radio `--radius-control` (10px), alto desde `--control-h` y texto en caja
 * normal. El anillo de foco lo pone `:focus-visible` en globals.css, por eso acá
 * no hay ninguna clase de anillo.
 */
const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center gap-2 rounded-control text-body font-semibold whitespace-nowrap transition-[filter,background-color,border-color,color] duration-(--duration-state) ease-standard active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-danger [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-icon",
    'border border-transparent',
  ],
  {
    variants: {
      variant: {
        default: 'gradient-action text-white shadow-flame hover:brightness-110',
        destructive: 'tint border text-danger-text hover:[--tint-fill:18%]',
        destructiveSolid: 'bg-danger text-white hover:brightness-110',
        outline: 'border-line bg-surface-2 text-text hover:border-flame',
        secondary: 'border-line bg-surface-2 text-text hover:border-flame',
        ghost: 'text-text-dim hover:bg-surface-2 hover:text-text',
        link: 'text-text underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-control px-5 has-[>svg]:px-4',
        xs: 'h-[calc(var(--control-h)_-_12px)] gap-1 px-2.5 text-dense has-[>svg]:px-2',
        sm: 'h-[calc(var(--control-h)_-_6px)] gap-1.5 px-3.5 text-dense has-[>svg]:px-3',
        lg: 'h-[calc(var(--control-h)_+_8px)] px-7 has-[>svg]:px-5',
        icon: 'size-control',
        'icon-xs': 'size-[calc(var(--control-h)_-_12px)]',
        'icon-sm': 'size-[calc(var(--control-h)_-_6px)]',
        'icon-lg': 'size-[calc(var(--control-h)_+_8px)]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

interface ButtonProps extends React.ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /**
   * Mutación en curso: el botón se deshabilita y aparece un spinner **al lado**
   * del texto, que sigue leyéndose («Entrando…», «Guardando…»). El texto no se
   * tapa: decir qué está pasando vale más que los pocos píxeles que crece.
   *
   * No se combina con `asChild`: ahí el hijo manda y `loading` se ignora.
   */
  loading?: boolean;
}

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  const showSpinner = loading && !asChild;

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-loading={showSpinner ? '' : undefined}
      disabled={asChild ? disabled : (disabled ?? false) || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {showSpinner ? (
        <>
          <Loader2 className="size-icon animate-spin" strokeWidth={1.5} aria-hidden />
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
