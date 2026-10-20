'use client';

import { Clock } from 'lucide-react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { useState, type KeyboardEvent, type ReactNode } from 'react';

import { fieldBoxClassName } from '@/components/ui/field-box';
import { Label } from '@/components/ui/label';
import {
  CLOCK_HOURS,
  CLOCK_MINUTES,
  clockLabel,
  fromClockParts,
  toClockParts,
  type ClockTime,
} from '@/lib/clock-time';
import { cn } from '@/lib/utils';

/** La hora que propone el reloj cuando el campo está vacío. */
const DEFAULT_TIME = '09:00';

/**
 * La hora de un formulario (119): la caja de campo de siempre y un reloj chico
 * que flota junto a ella —horas 1–12, cuartos de hora y AM/PM—. Hermano de
 * `DatePickerField`: el mismo Popover de Radix, y en el teléfono sube desde
 * abajo como hoja. Cada toque cambia el valor; elegir el minuto cierra.
 *
 * Una hora que no cae en un cuarto (`10:07`) se muestra tal cual y ningún
 * minuto queda marcado.
 */
export function TimePickerField({
  id,
  label,
  value,
  onChange,
  error,
  placeholder = 'Sin hora',
  min,
  className,
}: {
  id: string;
  label: string;
  /** `HH:MM` en 24 h, o `''` si no hay hora. */
  value: ClockTime;
  onChange: (time: ClockTime) => void;
  error?: string;
  placeholder?: string;
  /** La primera hora que se puede elegir (`HH:MM`); las anteriores quedan apagadas. */
  min?: ClockTime;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const empty = value === '';
  const parts = toClockParts(empty ? DEFAULT_TIME : value);
  const before = (time: ClockTime) => min !== undefined && time < min;
  const pick = (next: Partial<typeof parts>, close = false) => {
    const time = fromClockParts({ ...parts, ...next });
    // Una hora que deja el minuto antes del mínimo sube al mínimo.
    onChange(min !== undefined && time < min ? min : time);
    if (close) setOpen(false);
  };

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        <PopoverPrimitive.Anchor asChild>
          <div
            data-slot="field-box"
            className={cn(
              fieldBoxClassName,
              'cursor-pointer',
              'hover:border-flame has-[button:focus-visible]:border-flame',
              open && 'border-flame',
              error !== undefined && 'border-danger',
            )}
            onClick={(event) => {
              if ((event.target as HTMLElement).closest('button, label')) return;
              setOpen((current) => !current);
            }}
          >
            <Label htmlFor={id}>{label}</Label>
            <PopoverPrimitive.Trigger asChild>
              <button
                id={id}
                type="button"
                aria-invalid={error !== undefined ? true : undefined}
                className="text-text text-body flex w-full min-w-0 items-center gap-2 text-left focus-visible:outline-none"
              >
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate',
                    empty ? 'text-text-faint' : 'font-mono tabular-nums',
                  )}
                >
                  {empty ? placeholder : clockLabel(value)}
                </span>
                <Clock
                  className="text-text-faint size-icon shrink-0"
                  strokeWidth={1.5}
                  aria-hidden
                />
              </button>
            </PopoverPrimitive.Trigger>
          </div>
        </PopoverPrimitive.Anchor>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            data-slot="time-picker"
            side="bottom"
            align="start"
            sideOffset={6}
            collisionPadding={12}
            aria-label={label}
            // La misma capa que el calendario (`date-picker-field.tsx`); en el
            // teléfono es una hoja al pie (`globals.css`).
            className="border-line bg-surface-2 text-text shadow-dialog z-50 flex justify-center gap-2.5 rounded-card border p-2.5 max-md:w-full max-md:rounded-b-none max-md:border-x-0 max-md:border-b-0 max-md:pb-[calc(0.625rem+env(safe-area-inset-bottom))]"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              const content = event.currentTarget as HTMLElement;
              content
                .querySelector<HTMLButtonElement>(
                  '[aria-pressed="true"]:not(:disabled), button:not(:disabled)',
                )
                ?.focus({ preventScroll: true });
            }}
          >
            <ClockGroup
              label="Hora"
              columns={4}
              className="grid-cols-[repeat(4,max(var(--touch-min),2.5rem))] max-md:flex-1 max-md:grid-cols-4"
            >
              {CLOCK_HOURS.map((hour) => (
                <ClockOption
                  key={hour}
                  pressed={!empty && hour === parts.hour}
                  disabled={before(fromClockParts({ ...parts, hour, minute: 59 }))}
                  onClick={() => pick({ hour })}
                >
                  {String(hour).padStart(2, '0')}
                </ClockOption>
              ))}
            </ClockGroup>
            <span className="bg-line-soft w-px self-stretch" aria-hidden />
            <ClockGroup
              label="Minutos"
              columns={1}
              className="grid-cols-[max(var(--touch-min),3rem)]"
            >
              {CLOCK_MINUTES.map((minute) => (
                <ClockOption
                  key={minute}
                  pressed={!empty && minute === parts.minute}
                  disabled={before(fromClockParts({ ...parts, minute }))}
                  onClick={() => pick({ minute }, true)}
                >
                  {`:${String(minute).padStart(2, '0')}`}
                </ClockOption>
              ))}
            </ClockGroup>
            <span className="bg-line-soft w-px self-stretch" aria-hidden />
            <ClockGroup
              label="AM o PM"
              columns={1}
              className="grid-cols-[max(var(--touch-min),3rem)]"
            >
              {[false, true].map((pm) => (
                <ClockOption
                  key={String(pm)}
                  pressed={!empty && pm === parts.pm}
                  disabled={before(pm ? '23:59' : '11:59')}
                  className="font-sans font-semibold"
                  onClick={() => pick({ pm })}
                >
                  {pm ? 'PM' : 'AM'}
                </ClockOption>
              ))}
            </ClockGroup>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
      {error === undefined ? null : (
        <p className="text-danger-text text-label" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Un bloque del reloj; las flechas mueven el foco dentro de él. */
function ClockGroup({
  label,
  columns,
  className,
  children,
}: {
  label: string;
  columns: number;
  className: string;
  children: ReactNode;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[event.key];
    if (move === undefined) return;
    event.preventDefault();
    const options = [...event.currentTarget.querySelectorAll('button')];
    const index = options.indexOf(document.activeElement as HTMLButtonElement);
    options[Math.min(options.length - 1, Math.max(0, index + move))]?.focus();
  };

  return (
    <div
      role="group"
      aria-label={label}
      className={cn('grid content-start gap-1', className)}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
}

function ClockOption({
  pressed,
  disabled = false,
  onClick,
  className,
  children,
}: {
  pressed: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'text-text min-h-[max(var(--control-h),var(--touch-min))] rounded-control border border-transparent px-1.5 font-mono text-dense font-medium tabular-nums select-none',
        'hover:bg-surface-3 transition-colors duration-(--duration-state) ease-standard',
        pressed && 'gradient-action border-transparent font-bold text-white',
        'disabled:text-text-faint disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
        className,
      )}
    >
      {children}
    </button>
  );
}
