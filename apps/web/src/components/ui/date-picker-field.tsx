'use client';

import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { fieldBoxClassName } from '@/components/ui/field-box';
import { Label } from '@/components/ui/label';
import {
  MONTHS,
  WEEKDAYS,
  addDays,
  addMonths,
  firstOfMonth,
  formatCivil,
  longLabel,
  monthCells,
  todayCivil,
  type CivilDate,
} from '@/lib/civil-date';
import { cn } from '@/lib/utils';

const MOVES: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

/**
 * La fecha de un formulario: la caja de campo de siempre —etiqueta adentro,
 * error debajo— y un calendario chico que flota junto a ella. Es un Popover de
 * Radix, así que dentro de un `Dialog` se apila, se da vuelta si no cabe y no
 * pelea por el foco. Puede quedar vacía (`''`): el calendario ofrece «Quitar».
 *
 * Para filtros y barras de herramientas sigue `DateField`/`DateRangeField`.
 */
export function DatePickerField({
  id,
  label,
  value,
  onChange,
  error,
  placeholder = 'Sin fecha',
  className,
}: {
  id: string;
  label: string;
  /** `YYYY-MM-DD`, o `''` si no hay fecha. */
  value: CivilDate;
  onChange: (date: CivilDate) => void;
  error?: string;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const pick = (date: CivilDate) => {
    onChange(date);
    setOpen(false);
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
                <Calendar
                  className="text-text-faint size-icon shrink-0"
                  strokeWidth={1.5}
                  aria-hidden
                />
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate',
                    value === '' ? 'text-text-faint' : 'font-mono tabular-nums',
                  )}
                >
                  {value === '' ? placeholder : formatCivil(value)}
                </span>
              </button>
            </PopoverPrimitive.Trigger>
          </div>
        </PopoverPrimitive.Anchor>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            data-slot="date-picker"
            side="bottom"
            align="start"
            sideOffset={6}
            collisionPadding={12}
            aria-label={label}
            // Un escalón arriba del diálogo (surface-2, filete fuerte) para que se lea
            // como otra capa; nunca más angosto que el campo que lo abre.
            className="border-line bg-surface-2 text-text shadow-dialog z-50 flex min-w-(--radix-popover-trigger-width) flex-col items-center rounded-card border p-2.5"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <MonthGrid value={value} onPick={pick} />
            <div className="border-line-soft mt-2 flex w-full items-center justify-between gap-2 border-t pt-2">
              {value === '' ? (
                <span />
              ) : (
                <Button type="button" variant="ghost" size="sm" onClick={() => pick('')}>
                  Quitar
                </Button>
              )}
              <Button type="button" variant="ghost" size="sm" onClick={() => pick(todayCivil())}>
                Hoy
              </Button>
            </div>
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

type View = 'days' | 'months' | 'years';

/** Siete columnas de día: el lado táctil, nunca menos de 36px. */
const DAY_COLUMNS = 'grid-cols-[repeat(7,max(var(--touch-min),2.25rem))]';

/** El mismo día en otro mes y año, recortado al último si no existe (31 → 28). */
function withMonth(civil: CivilDate, year: number, month: number): CivilDate {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(Number(civil.slice(8, 10)), last);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** El primer año del bloque de 12 que contiene a `year`. */
function yearBlockStart(year: number): number {
  return year - (((year % 12) + 12) % 12);
}

const STEP_LABELS: Record<View, [string, string]> = {
  days: ['Mes anterior', 'Mes siguiente'],
  months: ['Año anterior', 'Año siguiente'],
  years: ['Años anteriores', 'Años siguientes'],
};

/**
 * El calendario: mes y año arriba —cada uno abre su lista para saltar rápido—,
 * flechas para avanzar y la grilla de días con foco itinerante.
 */
function MonthGrid({ value, onPick }: { value: CivilDate; onPick: (date: CivilDate) => void }) {
  const today = todayCivil();
  const [focus, setFocus] = useState(value === '' ? today : value);
  const [view, setView] = useState<View>('days');
  const focusRef = useRef<HTMLButtonElement>(null);
  const keyboard = useRef(false);
  const cursor = firstOfMonth(focus);
  const month = cursor.slice(0, 7);
  const year = Number(cursor.slice(0, 4));
  const monthIndex = Number(cursor.slice(5, 7));
  const blockStart = yearBlockStart(year);

  // Al abrir, el foco va al día elegido (o a hoy); después sigue a las flechas.
  useEffect(() => {
    focusRef.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (!keyboard.current) return;
    keyboard.current = false;
    focusRef.current?.focus({ preventScroll: true });
  }, [focus]);

  const step = (direction: number) => {
    if (view === 'days') setFocus(addMonths(focus, direction));
    else if (view === 'months') setFocus(withMonth(focus, year + direction, monthIndex));
    else setFocus(withMonth(focus, year + direction * 12, monthIndex));
  };
  const headerButton = (pressed: boolean) =>
    cn(
      'text-text text-body min-h-(--touch-min) rounded-control px-2 font-semibold select-none',
      'hover:bg-surface-2 transition-colors duration-(--duration-state) ease-standard',
      pressed && 'bg-surface-2 text-flame-text',
    );
  const choice = (pressed: boolean) =>
    cn(
      'text-text min-h-[max(var(--control-h),var(--touch-min))] rounded-control border border-transparent px-2 text-dense font-medium select-none',
      'hover:bg-surface-2 transition-colors duration-(--duration-state) ease-standard',
      pressed && 'gradient-action border-transparent font-bold text-white',
    );

  return (
    // El ancho lo fija la grilla de días: siete celdas y seis huecos de 2px.
    <div className="w-[calc(7*max(var(--touch-min),2.25rem)+0.75rem)]">
      <div className="mb-2 flex items-center justify-between gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={STEP_LABELS[view][0]}
          onClick={() => step(-1)}
        >
          <ChevronLeft strokeWidth={1.5} />
        </Button>
        <div className="flex items-center gap-0.5" aria-live="polite">
          <button
            type="button"
            aria-pressed={view === 'months'}
            className={cn(headerButton(view === 'months'), 'capitalize')}
            onClick={() => setView(view === 'months' ? 'days' : 'months')}
          >
            {MONTHS[monthIndex - 1]}
          </button>
          <button
            type="button"
            aria-pressed={view === 'years'}
            className={cn(headerButton(view === 'years'), 'tabular-nums')}
            onClick={() => setView(view === 'years' ? 'days' : 'years')}
          >
            {view === 'years' ? `${blockStart} – ${blockStart + 11}` : year}
          </button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={STEP_LABELS[view][1]}
          onClick={() => step(1)}
        >
          <ChevronRight strokeWidth={1.5} />
        </Button>
      </div>

      {/* Las tres vistas miden lo mismo: los días siempre están (ocultos fuera de
          su vista) y meses y años se montan encima. Cambiar de vista no mueve
          el calendario ni lo da vuelta. */}
      <div className="relative">
        {view === 'months' ? (
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-4 gap-1.5">
            {MONTHS.map((name, index) => (
              <button
                key={name}
                type="button"
                aria-pressed={index + 1 === monthIndex}
                className={cn(choice(index + 1 === monthIndex), 'capitalize')}
                onClick={() => {
                  setFocus(withMonth(focus, year, index + 1));
                  setView('days');
                }}
              >
                {name.slice(0, 3)}
              </button>
            ))}
          </div>
        ) : null}

        {view === 'years' ? (
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-4 gap-1.5">
            {Array.from({ length: 12 }, (_, index) => blockStart + index).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={option === year}
                className={cn(choice(option === year), 'tabular-nums')}
                onClick={() => {
                  setFocus(withMonth(focus, option, monthIndex));
                  setView('months');
                }}
              >
                {option}
              </button>
            ))}
          </div>
        ) : null}

        <div className={cn(view !== 'days' && 'invisible')} aria-hidden={view !== 'days'}>
          <div className={cn('mb-1 grid gap-0.5', DAY_COLUMNS)} aria-hidden>
            {WEEKDAYS.map((name) => (
              <span
                key={name}
                className="text-label text-text-faint py-1 text-center font-semibold"
              >
                {name}
              </span>
            ))}
          </div>
          <div
            role="grid"
            className={cn('grid gap-0.5', DAY_COLUMNS)}
            onKeyDown={(event) => {
              const move = MOVES[event.key];
              if (move === undefined) return;
              event.preventDefault();
              keyboard.current = true;
              setFocus(addDays(focus, move));
            }}
          >
            {monthCells(cursor).map((civil) => {
              const selected = civil === value;
              const isFocus = civil === focus;

              return (
                <button
                  key={civil}
                  ref={isFocus ? focusRef : undefined}
                  type="button"
                  tabIndex={isFocus ? 0 : -1}
                  aria-label={longLabel(civil)}
                  aria-pressed={selected}
                  aria-current={civil === today ? 'date' : undefined}
                  className={cn(
                    'text-text grid aspect-square place-items-center rounded-control border border-transparent text-dense font-medium tabular-nums select-none',
                    'hover:bg-surface-2 transition-colors duration-(--duration-state) ease-standard',
                    civil.slice(0, 7) !== month && 'text-text-faint',
                    civil === today && 'border-line font-bold',
                    selected && 'gradient-action border-transparent font-bold text-white',
                  )}
                  onClick={() => onPick(civil)}
                >
                  {Number(civil.slice(8, 10))}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
