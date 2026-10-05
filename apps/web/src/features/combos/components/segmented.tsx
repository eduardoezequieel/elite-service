'use client';

import { cn } from '@/lib/utils';

/**
 * El selector segmentado de combos: el filtro de estado y Precio fijo /
 * Descuento %. La misma piel que el de Inventario (Productos · Insumos):
 * caja `--surface-2`, botón elegido en `--surface` con filete, `aria-pressed`
 * y alto `--touch-min`, así que en la bahía sube solo a 44px.
 */
export function Segmented<Value extends string>({
  items,
  value,
  onChange,
  'aria-label': ariaLabel,
  className,
}: {
  items: readonly { value: Value; label: string }[];
  value: Value;
  onChange: (next: Value) => void;
  'aria-label': string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'border-line bg-surface-2 flex max-w-full flex-wrap items-stretch gap-0.75 rounded-control border p-0.75',
        className,
      )}
    >
      {items.map((item) => {
        const pressed = item.value === value;

        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex min-h-(--touch-min) flex-1 cursor-pointer items-center justify-center rounded-(--segment-radius) border px-3.5 text-(length:--control-text-size) font-semibold whitespace-nowrap',
              'transition-colors duration-(--duration-state) ease-standard [[data-density=bahia]_&]:px-5 [[data-density=bahia]_&]:text-body',
              pressed
                ? 'border-line bg-surface text-text'
                : 'text-text-dim hover:text-text border-transparent',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
