import { cn } from '@/lib/utils';
import { initialsOf } from '@/features/inventory/delivery';

/**
 * Las iniciales del titular en su círculo (106), como en «¿A quién?» de la
 * entrega (091). `sm` en las listas flotantes; en la bahía sube de tamaño.
 */
export function HolderAvatar({
  name,
  size = 'md',
  on = false,
}: {
  name: string;
  size?: 'sm' | 'md';
  /** Elegido: lleva el filete de llama. */
  on?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full border font-bold',
        size === 'sm'
          ? 'size-8 text-label [[data-density=bahia]_&]:size-10 [[data-density=bahia]_&]:text-dense'
          : 'size-10 text-dense [[data-density=bahia]_&]:size-12 [[data-density=bahia]_&]:text-body',
        on ? 'border-flame bg-flame/14 text-flame-text' : 'border-line bg-surface-3 text-text-dim',
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
