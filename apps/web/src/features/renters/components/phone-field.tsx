'use client';

import { Check, ChevronDown, Search } from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { placeComboboxPanel, relativeToFrame } from '@/lib/combobox';
import { cn } from '@/lib/utils';

import {
  PHONE_COUNTRIES,
  flagOf,
  phoneCountry,
  searchCountries,
  type PhoneCountry,
} from '../phone-countries';

/** Los de arriba de la lista sin buscar: van separados del resto. */
const PINNED_COUNT = 4;

const DIALOG_CONTENT = '[data-slot="dialog-content"]';

/**
 * El celular con su país en la misma caja: bandera y código a la izquierda,
 * el número a la derecha. El país se elige en un panel del ancho del campo,
 * con buscador por nombre, sigla o código.
 */
export function PhoneField({
  id,
  label,
  country,
  phone,
  onCountryChange,
  onPhoneChange,
  className,
}: {
  id: string;
  label: string;
  /** ISO: `'SV'`. */
  country: string;
  phone: string;
  onCountryChange: (iso: string) => void;
  onPhoneChange: (value: string) => void;
  className?: string;
}) {
  const uid = useId();
  const listId = `${uid}-list`;
  const current = phoneCountry(country);

  const boxRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [frame, setFrame] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setFrame(boxRef.current?.closest<HTMLElement>(DIALOG_CONTENT) ?? null);
  }, []);

  const searching = query.trim() !== '';
  const visible = searching ? searchCountries(query) : PHONE_COUNTRIES.slice();

  const close = useCallback((focusBack: boolean) => {
    setOpen(false);
    setQuery('');
    if (focusBack) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  function openPanel(): void {
    setQuery('');
    setActive(Math.max(PHONE_COUNTRIES.indexOf(current), 0));
    setOpen(true);
  }

  function choose(next: PhoneCountry): void {
    if (next.iso !== country) onCountryChange(next.iso);
    setOpen(false);
    setQuery('');
    phoneRef.current?.focus({ preventScroll: true });
  }

  const place = useCallback(() => {
    const box = boxRef.current;
    const panel = panelRef.current;
    const list = listRef.current;
    if (!box || !panel || !list) return;

    list.style.maxHeight = '';
    const rect = box.getBoundingClientRect();
    const outer = frame?.getBoundingClientRect();
    const origin =
      frame && outer
        ? { top: outer.top + frame.clientTop, left: outer.left + frame.clientLeft }
        : { top: 0, left: 0 };
    const next = placeComboboxPanel(
      relativeToFrame(
        { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
        origin,
      ),
      panel.offsetHeight,
      list.offsetHeight,
      frame
        ? { width: frame.clientWidth, height: frame.clientHeight }
        : { width: window.innerWidth, height: window.innerHeight },
    );
    panel.style.top = `${Math.round(next.top)}px`;
    panel.style.left = `${Math.round(next.left)}px`;
    panel.style.width = `${Math.round(next.width)}px`;
    list.style.maxHeight = next.listMaxHeight === null ? '' : `${next.listMaxHeight}px`;
  }, [frame]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
  }, [open, place, visible.length]);

  // Al abrir: el foco al buscador y el elegido a la vista.
  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus({ preventScroll: true });
    const item = listRef.current?.querySelector('[aria-selected="true"]');
    if (item instanceof HTMLElement) item.scrollIntoView({ block: 'center' });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onMove = () => place();
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (boxRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close(false);
    };
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [close, open, place]);

  function move(step: number): void {
    if (visible.length === 0) return;
    const next = (active + step + visible.length) % visible.length;
    setActive(next);
    const item = listRef.current?.querySelectorAll('[role="option"]')[next];
    if (item instanceof HTMLElement) item.scrollIntoView({ block: 'nearest' });
  }

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      move(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const pick = visible[active];
      if (pick !== undefined) choose(pick);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === 'Tab') {
      close(false);
    }
  }

  const panel = open
    ? createPortal(
        <div
          ref={panelRef}
          data-slot="combobox-panel"
          className={cn(
            'border-line-soft bg-surface text-text pointer-events-auto z-[60] flex flex-col gap-1 rounded-card border p-1',
            frame ? 'absolute' : 'fixed',
          )}
        >
          <div className="relative">
            <Search
              aria-hidden
              strokeWidth={1.5}
              className="text-text-faint size-icon pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
            />
            <Input
              ref={searchRef}
              type="search"
              role="combobox"
              aria-label="Buscar país"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={visible.length === 0 ? undefined : `${uid}-opt-${active}`}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="done"
              data-keeps-escape
              placeholder="País, sigla o código"
              className="pl-10"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
                listRef.current?.scrollTo({ top: 0 });
              }}
              onKeyDown={onSearchKey}
            />
          </div>

          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Países"
            className="flex max-h-72 flex-col gap-0.5 overflow-y-auto overscroll-contain"
          >
            {visible.length === 0 ? (
              <li
                role="presentation"
                className="text-text-faint flex min-h-touch items-center px-2.5 text-dense"
              >
                Sin coincidencias
              </li>
            ) : (
              visible.map((option, index) => {
                const selected = option.iso === current.iso;
                return (
                  <li
                    key={option.iso}
                    id={`${uid}-opt-${index}`}
                    role="option"
                    aria-selected={selected}
                    data-active={index === active ? 'true' : undefined}
                    className={cn(
                      'flex min-h-touch cursor-pointer items-center gap-3 rounded-control px-2.5 py-1 text-body',
                      'data-[active=true]:bg-surface-2',
                      selected && 'font-bold',
                      !searching &&
                        index === PINNED_COUNT &&
                        'border-line-soft mt-1 rounded-t-none border-t pt-2',
                    )}
                    onMouseDown={(event) => event.preventDefault()}
                    onPointerMove={() => setActive(index)}
                    onClick={() => choose(option)}
                  >
                    <span aria-hidden className="shrink-0 text-xl leading-none">
                      {flagOf(option.iso)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{option.name}</span>
                    <span className="text-text-faint shrink-0 font-mono text-dense font-bold tabular-nums">
                      {option.code}
                    </span>
                    <Check
                      aria-hidden
                      strokeWidth={1.5}
                      className={cn(
                        'text-flame-text size-icon shrink-0',
                        selected ? 'visible' : 'invisible',
                      )}
                    />
                  </li>
                );
              })
            )}
          </ul>
        </div>,
        frame ?? document.body,
      )
    : null;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <FieldBox
        ref={boxRef}
        data-open={open ? 'true' : undefined}
        className="data-[open=true]:border-flame"
      >
        <Label htmlFor={id}>{label}</Label>
        <div className="flex items-center gap-2">
          <button
            ref={triggerRef}
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-label={`País: ${current.name} ${current.code}`}
            className="text-text hover:bg-surface -my-1 -ml-1.5 flex min-h-touch shrink-0 items-center gap-1.5 rounded-control px-1.5 transition-colors duration-(--duration-state) ease-standard"
            onClick={() => (open ? close(true) : openPanel())}
            onKeyDown={(event) => {
              if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
                event.preventDefault();
                openPanel();
              }
            }}
          >
            <span aria-hidden className="text-lg leading-none">
              {flagOf(current.iso)}
            </span>
            <span className="font-mono text-body tabular-nums">{current.code}</span>
            <ChevronDown
              aria-hidden
              strokeWidth={1.5}
              className={cn(
                'text-text-faint size-icon transition-transform duration-(--duration-state) ease-standard',
                open && 'rotate-180',
              )}
            />
          </button>
          <span aria-hidden className="bg-line h-5 w-px shrink-0" />
          <Input
            ref={phoneRef}
            id={id}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            className="font-mono"
            placeholder={current.mask ?? undefined}
            value={phone}
            onChange={(event) => onPhoneChange(event.target.value)}
          />
        </div>
      </FieldBox>
      {panel}
    </div>
  );
}
