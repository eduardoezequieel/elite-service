'use client';

import { useRef, type KeyboardEvent } from 'react';

import { cn } from '@/lib/utils';

/** Cobrar en el momento o anotarlo a la cuenta de alguien (105). */
export type SaleMode = 'NOW' | 'TAB';

const MODES: readonly { value: SaleMode; label: string }[] = [
  { value: 'NOW', label: 'Cobrar ahora' },
  { value: 'TAB', label: 'Anotar a cuenta' },
];

/**
 * El selector «Cobrar ahora | Anotar a cuenta», a todo el ancho del resumen.
 * Es un grupo de radio: un tabulador entra y las flechas cambian. Mide
 * `--control-h`, así que en la bahía sube solo.
 */
export function SaleModeSwitch({
  value,
  onValueChange,
}: {
  value: SaleMode;
  onValueChange: (value: SaleMode) => void;
}) {
  const refs = useRef(new Map<SaleMode, HTMLButtonElement>());

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;

    event.preventDefault();
    const next = value === 'NOW' ? 'TAB' : 'NOW';
    onValueChange(next);
    refs.current.get(next)?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label="Cómo se paga"
      onKeyDown={onKeyDown}
      className="border-line bg-surface-2 flex gap-0.75 rounded-control border p-0.75"
    >
      {MODES.map((mode) => {
        const selected = mode.value === value;

        return (
          <button
            key={mode.value}
            ref={(node) => {
              if (node === null) refs.current.delete(mode.value);
              else refs.current.set(mode.value, node);
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onValueChange(mode.value)}
            className={cn(
              'min-h-[calc(var(--control-h)-6px)] flex-1 cursor-pointer rounded-(--segment-radius) border px-3 font-semibold',
              'transition-colors duration-(--duration-state) ease-standard',
              selected
                ? 'border-line bg-surface text-text'
                : 'text-text-dim hover:text-text border-transparent',
            )}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
