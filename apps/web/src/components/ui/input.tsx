import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Campo de texto. Suelto: fondo `--surface-2`, filete `--line`, radio
 * `--radius-control` (10px) y alto `--control-h`.
 *
 * Dentro de `<FieldBox>` pierde caja propia: la etiqueta y el valor comparten
 * el padding de `--field-*`. En foco el filete pasa a `--flame`; el anillo de
 * 2px lo pone `:focus-visible` en globals.css. Con `aria-invalid` el filete
 * pasa a `--danger`.
 */
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-control border-line bg-surface-2 text-text placeholder:text-text-faint w-full min-w-0 rounded-control border px-3.5 text-body transition-colors duration-(--duration-state) ease-standard file:inline-flex file:border-0 file:bg-transparent file:text-body file:font-medium file:text-text disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:border-flame',
        'aria-invalid:border-danger',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
