import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Área de texto multilínea: fondo `--surface-2`, filete `--line`, radio
 * `--radius-control` (10px). En foco el filete pasa a `--flame`; el anillo de
 * 2px lo pone `:focus-visible` en globals.css.
 */
function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'border-line bg-surface-2 text-text placeholder:text-text-faint w-full min-w-0 min-h-20 rounded-control border px-3 py-2.5 text-body transition-colors duration-(--duration-state) ease-standard disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:border-flame',
        'aria-invalid:border-danger',
        'resize-y',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
