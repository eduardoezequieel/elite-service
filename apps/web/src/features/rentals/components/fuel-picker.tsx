'use client';

import { FUEL_EIGHTHS_MAX, fuelLabel } from '@elite/shared';

import { cn } from '@/lib/utils';
import { FUEL_QUARTERS, fuelQuarterLabel } from '../fuel-scale';

const LEVELS = Array.from({ length: FUEL_EIGHTHS_MAX + 1 }, (_, index) => index);

/**
 * El combustible en octavos (RN-7), para el dedo: nueve botones grandes de
 * `--touch-min` o más, tres por fila en el celular y en una sola en escritorio.
 * Arriba, la barra del tanque con lo marcado, también escrito.
 */
export function FuelPicker({
  value,
  onChange,
  invalid = false,
  scale = 'eighths',
}: {
  value: number | null;
  onChange: (eighths: number) => void;
  invalid?: boolean;
  /** `quarters`: Vacío, ¼, ½, ¾, Lleno (0/2/4/6/8). `eighths`: los nueve del contrato. */
  scale?: 'eighths' | 'quarters';
}) {
  const levels = scale === 'quarters' ? FUEL_QUARTERS.map((level) => level.eighths) : LEVELS;
  const labelOf = (level: number) =>
    scale === 'quarters' ? (fuelQuarterLabel(level) ?? fuelLabel(level)) : fuelLabel(level);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div
          aria-hidden
          className="border-line bg-surface-2 grid h-3 flex-1 grid-cols-8 gap-0.5 overflow-hidden rounded-full border p-0.5"
        >
          {LEVELS.slice(1).map((level) => (
            <span
              key={level}
              className={cn(
                'rounded-full',
                value !== null && level <= value ? 'bg-flame' : 'bg-transparent',
              )}
            />
          ))}
        </div>
        <span className="text-title w-16 text-right tabular-nums">
          {value === null ? '—' : labelOf(value)}
        </span>
      </div>

      <div
        role="radiogroup"
        aria-label={scale === 'quarters' ? 'Combustible' : 'Combustible en octavos'}
        aria-invalid={invalid || undefined}
        className={cn(
          'grid grid-cols-3 gap-2',
          scale === 'quarters'
            ? 'sm:grid-cols-5'
            : 'sm:grid-cols-9 [[data-density=bahia]_&]:sm:grid-cols-5',
        )}
      >
        {levels.map((level) => {
          const checked = value === level;

          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onChange(level)}
              className={cn(
                'bg-surface-2 text-text min-h-(--touch-min) rounded-control border-(length:--selectable-border) px-2 py-2 text-body font-semibold tabular-nums transition-colors duration-(--duration-state) ease-standard',
                '[[data-density=bahia]_&]:min-h-14',
                checked ? 'border-flame' : 'border-line hover:border-flame',
                invalid && !checked && 'border-danger',
              )}
            >
              {labelOf(level)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
