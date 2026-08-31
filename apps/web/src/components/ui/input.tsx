import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Campo de texto: fondo Lámina, filete de 1px, radio 3px y alto desde `--control-h`.
 * En foco el filete pasa a Naranja Elite; el anillo lo pone `:focus-visible` global.
 */
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-control w-full min-w-0 rounded-md border border-input bg-card px-2.5 text-body transition-colors duration-(--duration-state) ease-standard selection:bg-primary selection:text-primary-foreground file:inline-flex file:border-0 file:bg-transparent file:text-body file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:border-brand',
        'aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
