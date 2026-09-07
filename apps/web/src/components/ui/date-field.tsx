'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  addDays,
  addMonths,
  firstOfMonth,
  formatCivil,
  longLabel,
  maskDate,
  matchingPreset,
  monthCells,
  monthLabel,
  MONTHS,
  parseTyped,
  presetRange,
  RANGE_PRESETS,
  rangeSummary,
  todayCivil,
  WEEKDAYS,
  type CivilDate,
  type CivilRange,
} from '@/lib/civil-date';
import { cn } from '@/lib/utils';

type View = 'days' | 'months' | 'years';

const COMPACT_QUERY = '(max-width: 899.98px)';

function useCompact(): boolean {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(COMPACT_QUERY);
    const sync = () => setCompact(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return compact;
}

function yearBlockStart(year: number): number {
  return year - (((year % 12) + 12) % 12);
}

function placePanel(panel: HTMLElement, trigger: HTMLElement, compact: boolean): void {
  if (compact) {
    panel.style.top = '';
    panel.style.bottom = '';
    panel.style.left = '';
    panel.style.right = '';
    panel.style.maxHeight = '';
    panel.style.width = '';
    panel.dataset.clipped = 'false';
    return;
  }

  const gap = 8;
  const edge = 12;
  const rect = trigger.getBoundingClientRect();
  const width = panel.offsetWidth;
  const height = panel.offsetHeight;

  let left = rect.left;
  if (left + width > window.innerWidth - edge && rect.right - width >= edge) {
    left = rect.right - width;
  }
  panel.style.left = `${Math.max(edge, left)}px`;
  panel.style.right = 'auto';
  panel.style.width = 'max-content';

  const below = window.innerHeight - rect.bottom - gap - edge;
  const above = rect.top - gap - edge;

  if (height <= below) {
    panel.style.top = `${rect.bottom + gap}px`;
    panel.style.bottom = 'auto';
    panel.style.maxHeight = '';
    panel.dataset.clipped = 'false';
    return;
  }

  if (height <= above) {
    panel.style.top = 'auto';
    panel.style.bottom = `${window.innerHeight - rect.top + gap}px`;
    panel.style.maxHeight = '';
    panel.dataset.clipped = 'false';
    return;
  }

  if (above > below) {
    panel.style.top = 'auto';
    panel.style.bottom = `${window.innerHeight - rect.top + gap}px`;
    panel.style.maxHeight = `${Math.max(above, 0)}px`;
  } else {
    panel.style.top = `${rect.bottom + gap}px`;
    panel.style.bottom = 'auto';
    panel.style.maxHeight = `${Math.max(below, 0)}px`;
  }
  panel.dataset.clipped = 'true';
}

export function DateField({
  value,
  onChange,
  'aria-label': ariaLabel = 'Seleccionar fecha',
}: {
  value: CivilDate;
  onChange: (date: CivilDate) => void;
  'aria-label'?: string;
}) {
  const today = todayCivil();

  return (
    <div className="flex items-center gap-1.5">
      <Picker
        mode="single"
        date={value}
        ariaLabel={ariaLabel}
        onApplyDate={onChange}
        triggerLabel={value === today ? 'Hoy' : formatCivil(value)}
      />
      {value === today ? null : (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(today)}>
          Hoy
        </Button>
      )}
    </div>
  );
}

export function DateRangeField({
  value,
  onChange,
  'aria-label': ariaLabel = 'Seleccionar rango de fechas',
}: {
  value: CivilRange;
  onChange: (range: CivilRange) => void;
  'aria-label'?: string;
}) {
  return (
    <Picker
      mode="range"
      range={value}
      ariaLabel={ariaLabel}
      onApplyRange={onChange}
      triggerLabel={rangeSummary(value)}
    />
  );
}

function Picker(
  props:
    | {
        mode: 'single';
        date: CivilDate;
        ariaLabel: string;
        triggerLabel: string;
        onApplyDate: (date: CivilDate) => void;
      }
    | {
        mode: 'range';
        range: CivilRange;
        ariaLabel: string;
        triggerLabel: string;
        onApplyRange: (range: CivilRange) => void;
      },
) {
  const isRange = props.mode === 'range';
  const compact = useCompact();
  const uid = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);
  const goRef = useRef<HTMLInputElement>(null);
  const focusCellRef = useRef<HTMLButtonElement>(null);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('days');
  const [cursor, setCursor] = useState(() => firstOfMonth(isRange ? props.range.to : props.date));
  const [focus, setFocus] = useState(() => (isRange ? props.range.to : props.date));
  const [draft, setDraft] = useState<CivilRange>(() =>
    isRange ? props.range : { from: '', to: '' },
  );
  const [activeEnd, setActiveEnd] = useState<'from' | 'to'>('from');
  const [invalid, setInvalid] = useState(false);
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [goText, setGoText] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }, []);

  const openPanel = useCallback(() => {
    const seed = isRange
      ? (props.range.to !== '' ? props.range.to : props.range.from !== '' ? props.range.from : todayCivil())
      : props.date;
    setView('days');
    setInvalid(false);
    setFocus(seed);
    setCursor(firstOfMonth(seed));
    if (isRange) {
      setDraft(props.range);
      setActiveEnd('from');
      setFromText(formatCivil(props.range.from));
      setToText(formatCivil(props.range.to));
    } else {
      setGoText(formatCivil(props.date));
    }
    setOpen(true);
  }, [isRange, props]);

  useLayoutEffect(() => {
    if (!open || !panelRef.current || !triggerRef.current) return;
    placePanel(panelRef.current, triggerRef.current, compact);
  }, [open, view, cursor, draft, invalid, compact]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => {
      if (panelRef.current && triggerRef.current) {
        placePanel(panelRef.current, triggerRef.current, compact);
      }
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open, compact]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      if (compact) {
        focusCellRef.current?.focus({ preventScroll: true });
        return;
      }
      (isRange ? fromRef.current : goRef.current)?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, compact, isRange]);

  useEffect(() => {
    if (!open || view !== 'days') return;
    const active = document.activeElement;
    if (active instanceof HTMLInputElement) return;
    focusCellRef.current?.focus({ preventScroll: true });
  }, [focus, open, view]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open || compact) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open, compact, close]);

  function step(direction: number) {
    if (view === 'days') {
      const next = addMonths(focus, direction);
      setFocus(next);
      setCursor(firstOfMonth(next));
      return;
    }
    if (view === 'months') {
      setCursor(`${Number(cursor.slice(0, 4)) + direction}${cursor.slice(4)}`);
      return;
    }
    setCursor(`${Number(cursor.slice(0, 4)) + direction * 12}${cursor.slice(4)}`);
  }

  function moveFocus(civil: CivilDate) {
    setFocus(civil);
    if (civil.slice(0, 7) !== cursor.slice(0, 7)) setCursor(firstOfMonth(civil));
  }

  function pickDay(civil: CivilDate) {
    setFocus(civil);
    setCursor(firstOfMonth(civil));

    if (!isRange) {
      props.onApplyDate(civil);
      close();
      return;
    }

    setInvalid(false);
    if (activeEnd === 'from' || draft.from === '') {
      setDraft({ from: civil, to: '' });
      setFromText(formatCivil(civil));
      setToText('');
      setActiveEnd('to');
      return;
    }
    if (civil < draft.from) {
      setDraft({ from: civil, to: '' });
      setFromText(formatCivil(civil));
      setToText('');
      setActiveEnd('to');
      return;
    }
    setDraft({ from: draft.from, to: civil });
    setToText(formatCivil(civil));
    setActiveEnd('from');
  }

  function applyRange() {
    if (!isRange) return;
    if (draft.from === '' || draft.to === '' || invalid) return;
    props.onApplyRange(draft);
    close();
  }

  function commitFields() {
    if (!isRange) return;
    const from = parseTyped(fromText);
    const to = parseTyped(toText);
    if (from === null || to === null) {
      setInvalid(false);
      setFromText(formatCivil(draft.from));
      setToText(formatCivil(draft.to));
      return;
    }
    const reversed = from > to;
    if (reversed === invalid && from === draft.from && to === draft.to) return;
    setInvalid(reversed);
    if (reversed) return;
    setDraft({ from, to });
    setActiveEnd('from');
    setFocus(to);
    setCursor(firstOfMonth(to));
  }

  function onGridKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (event.key in moves) {
      event.preventDefault();
      moveFocus(addDays(focus, moves[event.key] ?? 0));
      return;
    }
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      const amount = event.key === 'PageUp' ? -1 : 1;
      moveFocus(addMonths(focus, event.shiftKey ? amount * 12 : amount));
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const weekday = (new Date(`${focus}T00:00:00Z`).getUTCDay() + 6) % 7;
      moveFocus(addDays(focus, event.key === 'Home' ? -weekday : 6 - weekday));
    }
  }

  const today = todayCivil();
  const month = cursor.slice(0, 7);
  const cells = monthCells(cursor);
  const year = Number(cursor.slice(0, 4));
  const yearsStart = yearBlockStart(year);
  const applyDisabled = draft.from === '' || draft.to === '' || invalid;
  const presetKey = invalid ? '' : matchingPreset(draft);
  const stateLine = isRange
    ? draft.from === ''
      ? 'Tocá la fecha inicial.'
      : draft.to === ''
        ? `Desde ${formatCivil(draft.from)}. Ahora la final.`
        : activeEnd === 'to'
          ? `Desde ${formatCivil(draft.from)}. Tocá la nueva final.`
          : `De ${formatCivil(draft.from)} a ${formatCivil(draft.to)}. Tocá la nueva inicial.`
    : `Elegido: ${formatCivil(props.mode === 'single' ? props.date : '')}`;

  const panel = open ? (
    <div
      ref={panelRef}
      data-slot="date-panel"
      data-clipped="false"
      role="dialog"
      aria-modal="false"
      aria-label={props.ariaLabel}
      className={cn(
        'border-line-soft bg-surface text-text z-50 flex flex-col overflow-hidden border p-3',
        'max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:w-full',
        'max-md:rounded-card max-md:rounded-b-none max-md:border-b-0',
        'max-md:max-h-[calc(100svh-3rem)] max-md:overflow-y-auto',
        'max-md:pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
        'md:fixed md:rounded-card md:shadow-dialog',
        'data-[clipped=true]:overflow-y-auto',
      )}
    >
      <div className="bg-line mx-auto mb-2.5 hidden h-1 w-(--touch-min) rounded-full max-md:block" aria-hidden />

      <div className="flex items-stretch gap-3 max-md:flex-col max-md:gap-2.5">
        {isRange ? (
          <div
            className="border-line-soft flex w-44 shrink-0 flex-col gap-0.5 border-r pr-2.5 max-md:w-auto max-md:flex-row max-md:flex-wrap max-md:gap-1.5 max-md:border-r-0 max-md:border-b max-md:pr-0 max-md:pb-2.5"
            role="group"
            aria-label="Atajos"
          >
            <p className="text-label text-text-faint px-2.5 py-1 max-md:hidden">Atajos</p>
            {RANGE_PRESETS.map((preset) => {
              const pressed = preset.key === presetKey;
              return (
                <button
                  key={preset.key}
                  type="button"
                  aria-pressed={pressed}
                  className={cn(
                    'text-text-dim flex min-h-(--touch-min) w-full items-center gap-2 rounded-control border border-transparent px-2.5 text-left font-semibold',
                    'hover:bg-surface-2 hover:text-text',
                    'max-md:w-auto max-md:rounded-full max-md:border-line max-md:bg-surface-2',
                    pressed && 'bg-surface-2 border-line text-text',
                  )}
                  onClick={() => {
                    const next = presetRange(preset.key);
                    setDraft(next);
                    setFromText(formatCivil(next.from));
                    setToText(formatCivil(next.to));
                    setActiveEnd('from');
                    setFocus(next.to);
                    setCursor(firstOfMonth(next.to));
                    setInvalid(false);
                    setView('days');
                  }}
                >
                  <span className="min-w-0 flex-1">{preset.label}</span>
                  <Check
                    className={cn('text-flame-text size-icon shrink-0', pressed ? 'visible' : 'invisible')}
                    strokeWidth={2}
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          {isRange ? (
            <div className="mb-2 flex items-end gap-2">
              <FieldBox className="min-w-0 flex-1" data-invalid={invalid ? 'true' : undefined}>
                <Label htmlFor={`${uid}-from`}>Desde</Label>
                <Input
                  ref={fromRef}
                  id={`${uid}-from`}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="dd/mm/yyyy"
                  aria-invalid={invalid}
                  aria-describedby={invalid ? `${uid}-error` : undefined}
                  value={fromText}
                  className="font-mono"
                  onChange={(event) => setFromText(maskDate(event.target.value))}
                  onBlur={commitFields}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    commitFields();
                  }}
                />
              </FieldBox>
              <span className="text-text-faint text-dense pb-(--field-pb)" aria-hidden>
                a
              </span>
              <FieldBox className="min-w-0 flex-1" data-invalid={invalid ? 'true' : undefined}>
                <Label htmlFor={`${uid}-to`}>Hasta</Label>
                <Input
                  ref={toRef}
                  id={`${uid}-to`}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="dd/mm/yyyy"
                  aria-invalid={invalid}
                  aria-describedby={invalid ? `${uid}-error` : undefined}
                  value={toText}
                  className="font-mono"
                  onChange={(event) => setToText(maskDate(event.target.value))}
                  onBlur={commitFields}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    commitFields();
                  }}
                />
              </FieldBox>
            </div>
          ) : (
            <FieldBox className="mb-2.5">
              <Label htmlFor={`${uid}-go`}>Ir a la fecha</Label>
              <Input
                ref={goRef}
                id={`${uid}-go`}
                inputMode="numeric"
                autoComplete="off"
                placeholder="dd/mm/yyyy"
                value={goText}
                className="font-mono"
                onChange={(event) => {
                  const next = maskDate(event.target.value);
                  setGoText(next);
                  const civil = parseTyped(next);
                  if (civil === null) return;
                  setFocus(civil);
                  setCursor(firstOfMonth(civil));
                  setView('days');
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  const civil = parseTyped(goText);
                  if (civil !== null) pickDay(civil);
                }}
              />
            </FieldBox>
          )}

          {isRange && invalid ? (
            <p id={`${uid}-error`} role="alert" className="text-danger-text text-dense mb-2 font-semibold">
              La fecha inicial es posterior a la final.
            </p>
          ) : null}

          <div className="mb-2 flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Anterior"
              onClick={() => step(-1)}
            >
              <ChevronLeft strokeWidth={1.5} />
            </Button>
            <button
              type="button"
              className="hover:bg-surface-2 text-text text-body flex min-h-(--touch-min) flex-1 items-center justify-center gap-1.5 rounded-control px-2.5 font-semibold"
              onClick={() =>
                setView((current) => (current === 'days' ? 'months' : current === 'months' ? 'years' : 'days'))
              }
            >
              <span>
                {view === 'days'
                  ? monthLabel(cursor)
                  : view === 'months'
                    ? cursor.slice(0, 4)
                    : `${yearsStart} – ${yearsStart + 11}`}
              </span>
              <ChevronDown className="text-text-faint size-icon" strokeWidth={1.5} aria-hidden />
            </button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Siguiente"
              onClick={() => step(1)}
            >
              <ChevronRight strokeWidth={1.5} />
            </Button>
          </div>

          {view === 'days' ? (
            <>
              <div className="mb-1 grid grid-cols-7 gap-0.5" aria-hidden>
                {WEEKDAYS.map((name) => (
                  <span
                    key={name}
                    className="text-label text-text-faint py-1 text-center font-semibold"
                  >
                    {name}
                  </span>
                ))}
              </div>
              <div role="grid" className="grid grid-cols-7 gap-0.5" onKeyDown={onGridKeyDown}>
                {cells.map((civil) => {
                  const selected = isRange
                    ? civil === draft.from || civil === draft.to
                    : civil === (props.mode === 'single' ? props.date : '');
                  const inRange =
                    isRange &&
                    draft.from !== '' &&
                    draft.to !== '' &&
                    civil > draft.from &&
                    civil < draft.to;
                  const isFocus = civil === focus;
                  return (
                    <button
                      key={civil}
                      ref={isFocus ? focusCellRef : undefined}
                      type="button"
                      tabIndex={isFocus ? 0 : -1}
                      aria-label={longLabel(civil)}
                      aria-current={civil === today ? 'date' : undefined}
                      data-civil={civil}
                      className={cn(
                        'min-h-[max(var(--control-h),var(--touch-min))] grid place-items-center rounded-control border border-transparent bg-transparent font-medium tabular-nums',
                        'text-text transition-colors duration-(--duration-state) ease-standard hover:bg-surface-2',
                        civil.slice(0, 7) !== month && 'text-text-faint',
                        civil === today && 'border-line font-bold',
                        inRange && 'text-flame tint rounded-none',
                        isRange && draft.from !== draft.to && civil === draft.from && 'rounded-r-none',
                        isRange && draft.from !== draft.to && civil === draft.to && 'rounded-l-none',
                        selected && 'bg-surface-3 border-flame text-text font-bold',
                      )}
                      onClick={() => pickDay(civil)}
                    >
                      {Number(civil.slice(8, 10))}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {view === 'months' ? (
            <div className="grid grid-cols-3 gap-1.5">
              {MONTHS.map((name, index) => {
                const pressed = index === Number(cursor.slice(5, 7)) - 1;
                return (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={pressed}
                    className={cn(
                      'border-line bg-surface-2 text-text min-h-[max(var(--control-h),var(--touch-min))] rounded-control border px-2 font-medium',
                      'hover:border-flame',
                      pressed && 'bg-surface-3 border-flame font-bold',
                    )}
                    onClick={() => {
                      setCursor(`${cursor.slice(0, 5)}${String(index + 1).padStart(2, '0')}-01`);
                      setView('days');
                    }}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          ) : null}

          {view === 'years' ? (
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 12 }, (_, index) => yearsStart + index).map((value) => {
                const pressed = value === year;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={pressed}
                    className={cn(
                      'border-line bg-surface-2 text-text min-h-[max(var(--control-h),var(--touch-min))] rounded-control border px-2 font-medium',
                      'hover:border-flame',
                      pressed && 'bg-surface-3 border-flame font-bold',
                    )}
                    onClick={() => {
                      setCursor(`${String(value)}${cursor.slice(4)}`);
                      setView('months');
                    }}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          ) : null}

          {!isRange && view === 'days' ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {(
                [
                  ['Hoy', 0],
                  ['Ayer', -1],
                  ['Hace una semana', -7],
                ] as const
              ).map(([label, offset]) => (
                <button
                  key={label}
                  type="button"
                  className="border-line bg-surface-2 text-text-dim hover:border-flame hover:text-text text-dense min-h-(--touch-min) rounded-full border px-3 font-semibold"
                  onClick={() => pickDay(addDays(todayCivil(), offset))}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-line-soft mt-2.5 flex flex-wrap items-center gap-2 border-t pt-2.5">
        <p className="text-dense text-text-dim min-w-[12ch] flex-1">{stateLine}</p>
        {isRange ? (
          <>
            <Button type="button" variant="ghost" onClick={close}>
              Cancelar
            </Button>
            <Button type="button" disabled={applyDisabled} onClick={applyRange}>
              Aplicar
            </Button>
          </>
        ) : (
          <Button type="button" variant="ghost" onClick={() => pickDay(todayCivil())}>
            Hoy
          </Button>
        )}
      </div>
    </div>
  ) : null;

  const scrim =
    open && compact ? (
      <div
        data-slot="date-scrim"
        data-open="true"
        className="bg-bg/70 fixed inset-0 z-40 md:hidden"
        onClick={close}
      />
    ) : null;

  return (
    <>
      {isRange ? (
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={props.ariaLabel}
          className={cn(
            'border-line bg-surface-2 text-text inline-flex max-w-full items-center gap-2.5 rounded-control border px-3 font-semibold',
            'h-control min-h-(--touch-min)',
            'transition-colors duration-(--duration-state) ease-standard',
            'hover:border-flame aria-expanded:border-flame',
          )}
          onClick={() => (open ? close() : openPanel())}
        >
          <Calendar className="text-text-faint size-icon shrink-0" strokeWidth={1.5} aria-hidden />
          <span className="min-w-0 truncate tabular-nums">{props.triggerLabel}</span>
          <ChevronDown
            className={cn(
              'text-text-faint size-icon shrink-0 transition-transform duration-(--duration-state) ease-standard',
              open && 'rotate-180',
            )}
            strokeWidth={1.5}
            aria-hidden
          />
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={props.ariaLabel}
          className={cn(buttonVariants({ variant: 'outline' }), 'relative gap-2')}
          onClick={() => (open ? close() : openPanel())}
        >
          <Calendar className="text-text-faint size-icon shrink-0" strokeWidth={1.5} aria-hidden />
          <span>{props.triggerLabel}</span>
        </button>
      )}
      {mounted ? createPortal(
        <>
          {scrim}
          {panel}
        </>,
        document.body,
      ) : null}
    </>
  );
}
