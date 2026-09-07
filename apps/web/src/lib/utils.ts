import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        'text-label',
        'text-dense',
        'text-body',
        'text-title',
        'text-headline',
        'text-display',
        'text-figure',
      ],
      'text-color': [
        'text-text',
        'text-text-dim',
        'text-text-faint',
        'text-flame',
        'text-flame-hot',
        'text-flame-deep',
        'text-flame-text',
        'text-go',
        'text-go-text',
        'text-danger',
        'text-danger-text',
        'text-warn',
        'text-warn-text',
        'text-rail-text',
        'text-rail-dim',
        'text-rail-faint',
      ],
    },
  },
});

/** Combina clases condicionales y resuelve conflictos de utilidades Tailwind. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

