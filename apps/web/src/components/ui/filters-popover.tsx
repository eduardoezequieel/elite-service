'use client';

import { ChevronDown, ListFilter } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import {
  ALL_FILTER,
  countActiveFilters,
  FILTERS_WIDTH,
  placeFiltersPanel,
} from '@/lib/list-filters';
import { cn } from '@/lib/utils';

export type FilterField = {
  id: string;
  label: string;
  value: string;
  options: readonly ComboboxOption[];
  onChange: (value: string) => void;
};

export function FilterBar({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn('flex flex-wrap items-stretch gap-3', className)}>{children}</div>;
}

export function useFilterValues<K extends string>(
  keys: readonly K[],
): {
  values: Record<K, string>;
  set: (key: K, value: string) => void;
  reset: () => void;
} {
  const [values, setValues] = useState<Record<K, string>>(() => {
    const initial = {} as Record<K, string>;
    for (const key of keys) initial[key] = ALL_FILTER;

    return initial;
  });

  const set = useCallback((key: K, value: string) => {
    setValues((previous) => ({ ...previous, [key]: value }));
  }, []);

  const reset = useCallback(() => {
    setValues((previous) => {
      const next = { ...previous };
      for (const key of Object.keys(next) as K[]) next[key] = ALL_FILTER;

      return next;
    });
  }, []);

  return { values, set, reset };
}

/**
 * Botón Filtros + tarjeta con Combobox. El listado de cada Combobox vive en su
 * propio portal (spec 034); esta tarjeta ignora esos clics para no cerrarse.
 */
export function FiltersPopover({
  fields,
  onReset,
}: {
  fields: readonly FilterField[];
  onReset: () => void;
}) {
  const uid = useId();
  const titleId = `${uid}-title`;
  const panelId = `${uid}-panel`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const activeCount = countActiveFilters(fields.map((field) => field.value));

  useEffect(() => setMounted(true), []);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const next = placeFiltersPanel(
      trigger.getBoundingClientRect(),
      { width: FILTERS_WIDTH, height: panel.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
    );
    panel.style.top = `${Math.round(next.top)}px`;
    panel.style.left = `${Math.round(next.left)}px`;
    panel.style.width = `${Math.round(next.width)}px`;
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
  }, [open, fields, place]);

  useEffect(() => {
    if (!open) return;
    const onMove = () => place();
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('[data-slot="combobox-panel"]')) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const panel =
    mounted && open
      ? createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-labelledby={titleId}
            data-slot="filters-popover"
            className="border-line bg-surface text-text fixed z-50 flex max-h-[min(32rem,calc(100vh-1.5rem))] flex-col gap-3.5 overflow-y-auto rounded-card border p-4"
          >
            <div className="border-line-soft flex items-center justify-between gap-3 border-b pb-2">
              <p id={titleId} className="text-body font-bold">
                Filtros avanzados
              </p>
              <button
                type="button"
                className="text-flame-text text-dense font-semibold hover:underline"
                onClick={onReset}
              >
                Restablecer
              </button>
            </div>
            {fields.map((field) => (
              <Combobox
                key={field.id}
                label={field.label}
                options={field.options}
                value={field.value}
                onChange={field.onChange}
              />
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        data-slot="filters-trigger"
        className={cn(
          'border-line bg-surface-2 text-text inline-flex shrink-0 items-center justify-center gap-2 self-stretch rounded-control border px-5 text-body font-semibold',
          'min-h-(--touch-min) transition-colors duration-(--duration-state) ease-standard',
          'hover:border-flame focus-visible:border-flame',
          (open || activeCount > 0) && 'border-flame',
        )}
        onClick={() => setOpen((value) => !value)}
      >
        <ListFilter strokeWidth={1.5} aria-hidden className="size-icon" />
        Filtros
        {activeCount > 0 ? (
          <span className="bg-flame rounded-full px-[7px] py-px text-label font-bold text-white">
            {activeCount}
          </span>
        ) : null}
        <ChevronDown
          strokeWidth={1.5}
          aria-hidden
          className={cn(
            'size-icon transition-transform duration-(--duration-state) ease-standard',
            open && 'rotate-180',
          )}
        />
      </button>
      {panel}
    </>
  );
}
