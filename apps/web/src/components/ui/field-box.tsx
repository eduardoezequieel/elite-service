'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Caja de un campo de texto: la etiqueta y el valor viven adentro, con el
 * padding de `--field-*`. El error y la ayuda quedan afuera, debajo.
 *
 * Un clic en el padding o en la etiqueta enfoca el control. Los interruptores
 * y las listas de casillas no usan esta caja.
 */
function FieldBox({ className, onClick, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="field-box"
      className={cn(
        'border-line bg-surface-2 flex cursor-text flex-col gap-0.5 rounded-control border px-(--field-px) pt-(--field-pt) pb-(--field-pb) transition-colors duration-(--duration-state) ease-standard',
        'has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50',
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;

        const target = event.target as HTMLElement;
        if (target.closest('button, a, input, textarea, select')) return;

        const control = event.currentTarget.querySelector<HTMLInputElement | HTMLTextAreaElement>(
          'input:not([disabled]):not([type="hidden"]), textarea:not([disabled])',
        );
        control?.focus();
      }}
      {...props}
    />
  );
}

export { FieldBox };
