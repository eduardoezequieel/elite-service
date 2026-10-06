'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Las pestañas del sistema.
 *
 * Subrayado con el degradado de llama, contador tenue al lado y nada más: sin
 * fondo relleno, sin píldora y sin mayúsculas. Alto mínimo `--touch-min` porque
 * una pestaña es algo que se toca.
 *
 * Es un `tablist` de verdad (`role=tablist` / `role=tab`, `aria-selected`,
 * flechas ← → Inicio Fin), no tres botones sueltos. El panel lo dibuja la
 * pantalla: este componente solo manda el valor elegido hacia arriba.
 */
export interface TabItem<Value extends string = string> {
  /** El valor que se emite al elegirla. */
  value: Value;
  /** Texto visible, en español y en caja normal. */
  label: string;
  /** Cuántas filas hay detrás. Se dibuja solo si viene un número. */
  count?: number;
  /** Icono opcional de `lucide-react`, a la izquierda de la etiqueta. */
  icon?: LucideIcon;
}

export interface TabsProps<Value extends string = string> extends Omit<
  React.ComponentProps<'div'>,
  'onChange'
> {
  /** La pestaña elegida. */
  value: Value;
  onValueChange: (value: Value) => void;
  items: readonly TabItem<Value>[];
  /** Nombre de la barra para el lector de pantalla. */
  'aria-label'?: string;
  /**
   * En densidad bahía, píldoras de `--touch-min` en vez del subrayado.
   * Solo la ficha de un carro (110): el resto de las pantallas no cambia.
   */
  chipsOnBahia?: boolean;
}

/** Trazo del sistema para los iconos de `lucide-react`. */
const ICON_STROKE_WIDTH = 1.5;

export function Tabs<Value extends string = string>({
  value,
  onValueChange,
  items,
  className,
  chipsOnBahia = false,
  ...props
}: TabsProps<Value>) {
  const refs = React.useRef(new Map<string, HTMLButtonElement>());

  const focus = (next: TabItem<Value>) => {
    onValueChange(next.value);
    refs.current.get(next.value)?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex((item) => item.value === value);
    if (index < 0) return;

    const last = items.length - 1;
    const target =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? items[index === last ? 0 : index + 1]
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? items[index === 0 ? last : index - 1]
          : event.key === 'Home'
            ? items[0]
            : event.key === 'End'
              ? items[last]
              : undefined;

    if (target === undefined) return;

    event.preventDefault();
    focus(target);
  };

  return (
    <div
      data-slot="tabs"
      role="tablist"
      onKeyDown={onKeyDown}
      className={cn(
        'border-line-soft flex flex-wrap items-end gap-1 border-b',
        chipsOnBahia &&
          '[[data-density=bahia]_&]:items-center [[data-density=bahia]_&]:gap-2 [[data-density=bahia]_&]:border-0',
        className,
      )}
      {...props}
    >
      {items.map((item) => {
        const selected = item.value === value;
        const Icon = item.icon;

        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={`tab-${item.value}`}
            aria-selected={selected}
            aria-controls={`tabpanel-${item.value}`}
            tabIndex={selected ? 0 : -1}
            ref={(node) => {
              if (node === null) refs.current.delete(item.value);
              else refs.current.set(item.value, node);
            }}
            onClick={() => onValueChange(item.value)}
            className={cn(
              'relative -mb-px inline-flex min-h-(--touch-min) items-center gap-2 rounded-t-lg px-3.5 py-2.5 text-body font-semibold transition-colors duration-(--duration-state) ease-standard',
              chipsOnBahia &&
                '[[data-density=bahia]_&]:mb-0 [[data-density=bahia]_&]:rounded-control [[data-density=bahia]_&]:border [[data-density=bahia]_&]:border-line [[data-density=bahia]_&]:px-4 [[data-density=bahia]_&]:after:hidden',
              selected
                ? 'text-text after:absolute after:inset-x-2.5 after:-bottom-px after:h-(--tab-mark) after:rounded-sm after:[background-image:var(--gradient-action)] after:content-[""]'
                : 'text-text-faint hover:text-text-dim',
              selected &&
                chipsOnBahia &&
                '[[data-density=bahia]_&]:border-flame [[data-density=bahia]_&]:bg-surface-2',
            )}
          >
            {Icon ? (
              <Icon className="size-icon shrink-0" strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
            ) : null}
            {item.label}
            {item.count === undefined ? null : (
              <span className="text-text-faint text-label font-semibold tabular-nums">
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
