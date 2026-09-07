'use client';

import { Check, ChevronDown } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';

import { fieldBoxClassName } from '@/components/ui/field-box';
import {
  filterOptions,
  nextTypeaheadBuffer,
  placeComboboxPanel,
  typeaheadIndex,
  type ComboboxOption,
} from '@/lib/combobox';
import { cn } from '@/lib/utils';

export type { ComboboxOption };

type ComboboxBase = {
  label: string;
  placeholder?: string;
  options: readonly ComboboxOption[];
  value: string;
  disabled?: boolean;
  invalid?: boolean;
  emptyText?: string;
  id?: string;
  name?: string;
  onBlur?: () => void;
  className?: string;
};

export type ComboboxProps = ComboboxBase &
  (
    | {
        mode?: 'select';
        onChange: (value: string, option: ComboboxOption) => void;
      }
    | {
        mode: 'search';
        query: string;
        onQueryChange: (query: string) => void;
        onChange: (value: string, option: ComboboxOption) => void;
        onFreeText?: (query: string) => void;
        minQueryLength?: number;
        filter?: 'local' | 'off';
        enterKeyHint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send';
      }
  );

function isPrintable(event: KeyboardEvent): boolean {
  return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
}

function optionByValue(
  options: readonly ComboboxOption[],
  value: string,
): ComboboxOption | undefined {
  return options.find((option) => option.value === value);
}

/**
 * Elegir de una lista. Cerrado es la misma caja de campo que un `Input`.
 *
 * Dos modos: lista corta (`select`, typeahead) y búsqueda (`search`, se escribe
 * y Enter sin elegir deja el texto). El listado vive en un portal, del mismo
 * ancho que la caja; si no cabe abajo se da vuelta (spec 034).
 */
export function Combobox(props: ComboboxProps) {
  const isSearch = props.mode === 'search';
  const uid = useId();
  const triggerId = props.id ?? `${uid}-trigger`;
  const labelId = `${uid}-label`;
  const valueId = `${uid}-value`;
  const listId = `${uid}-list`;
  const placeholder = props.placeholder ?? '';

  const boxRef = useRef<HTMLButtonElement | HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typed = useRef({ buffer: '', at: 0 });

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const query = isSearch ? props.query : '';
  const minQueryLength = isSearch ? (props.minQueryLength ?? 0) : 0;
  const filterMode = isSearch ? (props.filter ?? 'local') : 'off';
  const queryReady = !isSearch || query.trim().length >= minQueryLength;

  const visible =
    isSearch && filterMode === 'local'
      ? filterOptions(props.options, query)
      : props.options.slice();

  const selected = optionByValue(props.options, props.value);
  const showPanel = isSearch
    ? open &&
      queryReady &&
      (visible.length > 0 || (filterMode === 'local' && query.trim() !== ''))
    : open;

  const onChange = props.onChange;

  const close = useCallback((focusBack: boolean) => {
    setOpen(false);
    setActive(-1);
    if (focusBack) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  const commit = useCallback(
    (option: ComboboxOption) => {
      onChange(option.value, option);
      close(true);
    },
    [close, onChange],
  );

  function openList(nextActive: number): void {
    if (props.disabled) return;
    setOpen(true);
    setActive(nextActive);
  }

  const commitActive = useCallback((): boolean => {
    if (active < 0 || active >= visible.length) return false;
    commit(visible[active]);
    return true;
  }, [active, commit, visible]);

  const place = useCallback(() => {
    const box = boxRef.current;
    const panel = panelRef.current;
    const list = listRef.current;
    if (!box || !panel || !list) return;

    list.style.maxHeight = '';
    const next = placeComboboxPanel(
      box.getBoundingClientRect(),
      panel.offsetHeight,
      list.offsetHeight,
      { width: window.innerWidth, height: window.innerHeight },
    );
    panel.style.top = `${Math.round(next.top)}px`;
    panel.style.left = `${Math.round(next.left)}px`;
    panel.style.width = `${Math.round(next.width)}px`;
    list.style.maxHeight = next.listMaxHeight === null ? '' : `${next.listMaxHeight}px`;
  }, []);

  useLayoutEffect(() => {
    if (!showPanel) return;
    place();
  }, [showPanel, visible.length, query, active, place]);

  useEffect(() => {
    if (!showPanel) return;
    const onMove = () => place();
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [place, showPanel]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (boxRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [close, open]);

  function moveActive(step: number): void {
    if (visible.length === 0) return;
    const from = active;
    const next =
      from < 0 ? (step > 0 ? 0 : visible.length - 1) : (from + step + visible.length) % visible.length;
    setActive(next);
    const item = listRef.current?.querySelectorAll('[data-slot="combobox-option"]')[next];
    if (item instanceof HTMLElement) item.scrollIntoView({ block: 'nearest' });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>): void {
    const key = event.key;

    if (!open) {
      if (isSearch && key === 'Enter') {
        event.preventDefault();
        if (props.mode === 'search') props.onFreeText?.(query.trim());
        return;
      }
      if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || (!isSearch && key === ' ')) {
        event.preventDefault();
        const selectedIndex = visible.findIndex((option) => option.value === props.value);
        const fallback = visible.length === 0 ? -1 : 0;
        if (key === 'ArrowUp') openList(visible.length === 0 ? -1 : visible.length - 1);
        else if (key === 'ArrowDown') openList(fallback);
        else openList(isSearch ? -1 : selectedIndex < 0 ? fallback : selectedIndex);
        return;
      }
      if (!isSearch && isPrintable(event)) {
        event.preventDefault();
        const next = nextTypeaheadBuffer(typed.current.buffer, typed.current.at, event.key, Date.now());
        typed.current = next;
        const index = typeaheadIndex(props.options, next.buffer, active);
        openList(index);
        return;
      }
      return;
    }

    if (key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (key === 'Tab') {
      close(false);
      return;
    }
    if (key === 'ArrowDown') {
      event.preventDefault();
      moveActive(1);
      return;
    }
    if (key === 'ArrowUp') {
      event.preventDefault();
      moveActive(-1);
      return;
    }
    if (key === 'Home' || key === 'End') {
      if (isSearch && active < 0 && query !== '') return;
      event.preventDefault();
      if (visible.length === 0) return;
      setActive(key === 'Home' ? 0 : visible.length - 1);
      return;
    }
    if (key === 'Enter') {
      event.preventDefault();
      if (commitActive()) return;
      close(true);
      if (isSearch && props.mode === 'search') props.onFreeText?.(query.trim());
      return;
    }
    if (key === ' ' && !isSearch) {
      event.preventDefault();
      commitActive();
      return;
    }
    if (!isSearch && isPrintable(event)) {
      event.preventDefault();
      const next = nextTypeaheadBuffer(typed.current.buffer, typed.current.at, event.key, Date.now());
      typed.current = next;
      const index = typeaheadIndex(visible, next.buffer, active);
      if (index >= 0) setActive(index);
    }
  }

  const activeId = active >= 0 ? `${uid}-opt-${active}` : undefined;
  const emptyMessage =
    isSearch && query.trim() !== ''
      ? 'Sin coincidencias'
      : (props.emptyText ?? 'Sin opciones');

  const caret = (
    <ChevronDown
      aria-hidden
      strokeWidth={1.5}
      className={cn(
        'text-text-faint size-icon shrink-0 transition-transform duration-(--duration-state) ease-standard',
        open && 'rotate-180',
      )}
    />
  );

  const panel =
    mounted && showPanel
      ? createPortal(
          <div
            ref={panelRef}
            data-slot="combobox-panel"
            data-open="true"
            className="border-line-soft bg-surface text-text pointer-events-auto fixed z-[60] rounded-card border p-1"
            onMouseDown={(event) => event.preventDefault()}
          >
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-labelledby={labelId}
              className="flex max-h-60 flex-col gap-0.5 overflow-y-auto overscroll-contain"
            >
              {visible.length === 0 ? (
                <li role="presentation" className="text-text-faint flex min-h-touch items-center px-2.5 text-dense">
                  {emptyMessage}
                </li>
              ) : (
                visible.map((option, index) => {
                  const isActive = index === active;
                  const isSelected = option.value === props.value;
                  return (
                    <li
                      key={option.value}
                      id={`${uid}-opt-${index}`}
                      role="option"
                      aria-selected={isSelected}
                      data-slot="combobox-option"
                      data-active={isActive ? 'true' : undefined}
                      className={cn(
                        'flex min-h-touch cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-1 text-body',
                        'data-[active=true]:bg-surface-2',
                        isSelected && 'bg-surface-2 font-bold',
                      )}
                      onPointerMove={() => setActive(index)}
                      onClick={() => commit(option)}
                    >
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      {option.meta !== undefined && option.meta !== '' ? (
                        <span className="text-text-faint shrink-0 font-mono text-dense font-bold tabular-nums">
                          {option.meta}
                        </span>
                      ) : null}
                      <Check
                        aria-hidden
                        strokeWidth={1.5}
                        className={cn(
                          'text-flame-text size-icon shrink-0',
                          isSelected ? 'visible' : 'invisible',
                        )}
                      />
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body,
        )
      : null;

  if (isSearch && props.mode === 'search') {
    const search = props;
    return (
      <div data-slot="combobox" className={cn('flex flex-col', props.className)}>
        <div
          ref={(node) => {
            boxRef.current = node;
          }}
          data-slot="field-box"
          data-open={open ? 'true' : undefined}
          className={cn(
            fieldBoxClassName,
            'data-[open=true]:border-flame',
            props.invalid && 'border-danger',
            props.disabled && 'cursor-not-allowed opacity-50',
          )}
          onClick={() => {
            if (props.disabled) return;
            triggerRef.current?.focus();
            if (!open) openList(-1);
          }}
        >
          <label htmlFor={triggerId} id={labelId} data-slot="label" className="text-text-dim">
            {props.label}
          </label>
          <div className="flex items-center gap-2">
            <input
              ref={(node) => {
                triggerRef.current = node;
              }}
              id={triggerId}
              name={props.name}
              type="text"
              role="combobox"
              aria-haspopup="listbox"
              aria-expanded={showPanel}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeId}
              aria-invalid={props.invalid || undefined}
              aria-labelledby={labelId}
              disabled={props.disabled}
              value={search.query}
              placeholder={placeholder}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint={search.enterKeyHint}
              onChange={(event) => {
                search.onQueryChange(event.target.value);
                setActive(-1);
                if (!open) setOpen(true);
              }}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                close(false);
                props.onBlur?.();
              }}
              className="text-text placeholder:text-text-faint min-w-0 flex-1 bg-transparent text-body outline-none"
            />
            {caret}
          </div>
        </div>
        {panel}
      </div>
    );
  }

  const display = selected === undefined ? placeholder : selected.label;

  return (
    <div data-slot="combobox" className={cn('flex flex-col', props.className)}>
      <button
        ref={(node) => {
          boxRef.current = node;
          triggerRef.current = node;
        }}
        type="button"
        id={triggerId}
        name={props.name}
        disabled={props.disabled}
        data-slot="field-box"
        data-open={open ? 'true' : undefined}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-activedescendant={activeId}
        aria-invalid={props.invalid || undefined}
        aria-labelledby={`${labelId} ${valueId}`}
        className={cn(
          fieldBoxClassName,
          'cursor-pointer text-left',
          'focus-visible:border-flame data-[open=true]:border-flame',
          'aria-invalid:border-danger',
          props.disabled && 'cursor-not-allowed',
        )}
        onClick={() => {
          if (open) {
            close(true);
            return;
          }
          const selectedIndex = visible.findIndex((option) => option.value === props.value);
          openList(selectedIndex < 0 ? (visible.length === 0 ? -1 : 0) : selectedIndex);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          close(false);
          props.onBlur?.();
        }}
      >
        <span id={labelId} data-slot="label" className="text-text-dim">
          {props.label}
        </span>
        <span className="flex items-center gap-2">
          <span
            id={valueId}
            className={cn(
              'min-w-0 flex-1 truncate text-body',
              selected === undefined ? 'text-text-faint' : 'text-text',
            )}
          >
            {display}
          </span>
          {caret}
        </span>
      </button>
      {panel}
    </div>
  );
}
