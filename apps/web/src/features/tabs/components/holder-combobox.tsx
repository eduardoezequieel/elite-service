'use client';

import type { TabHolderOption } from '@elite/shared';
import { Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';
import { useTabHolders } from '../hooks/use-tabs';
import { holdersInOrder } from '../tab-format';
import { HolderAvatar } from './holder-avatar';
import { HolderGroupLabel, HolderOptionRow } from './holder-option-row';

/**
 * «¿A quién se le anota?» (105): un combobox con la lista **flotante** encima de
 * lo que sigue —no empuja el resumen hacia abajo—. Se abre al entrar al campo y
 * busca en `GET /tabs/holders` con el respiro de la app (250 ms): primero
 * «Trabajadores», después «Clientes», cada uno con lo que ya debe.
 *
 * Flechas para recorrer (dan la vuelta), Enter elige el marcado y Escape
 * cierra; tocar afuera también. Elegida, la persona ocupa el lugar del campo
 * con «Cambiar».
 */
export function HolderCombobox({
  value,
  onChange,
}: {
  value: TabHolderOption | null;
  onChange: (holder: TabHolderOption) => void;
}) {
  const uid = useId();
  const inputId = `${uid}-search`;
  const listId = `${uid}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // «Cambiar» abre el buscador aunque ya haya alguien; sin nadie, se busca siempre.
  const [choosing, setChoosing] = useState(false);
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const search = useDebouncedValue(term.trim());
  const holders = useTabHolders(search, open);
  const flat = holdersInOrder(holders.data);
  const employees = holders.data?.employees ?? [];
  // Cada grupo sabe dónde empieza en la lista plana que recorren las flechas.
  const groups = [
    { label: 'Trabajadores', options: employees, offset: 0 },
    { label: 'Clientes', options: holders.data?.customers ?? [], offset: employees.length },
  ];
  const optionId = (index: number) => `${uid}-option-${index}`;

  // Tocar afuera cierra la lista.
  useEffect(() => {
    if (!open) return;

    const onPointer = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      // Cerrar sin elegir deja a quien ya estaba.
      setOpen(false);
      setChoosing(false);
    };

    document.addEventListener('pointerdown', onPointer);

    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  // Otra búsqueda arranca marcada en la primera.
  useEffect(() => setHighlighted(0), [search]);

  // La marcada se deja ver al moverse con las flechas.
  useEffect(() => {
    if (!open) return;
    document.getElementById(`${uid}-option-${highlighted}`)?.scrollIntoView({ block: 'nearest' });
  }, [highlighted, open, uid]);

  function take(holder: TabHolderOption): void {
    onChange(holder);
    setTerm('');
    setOpen(false);
    setChoosing(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      if (flat.length === 0) return;
      setHighlighted(
        (current) => (current + (event.key === 'ArrowDown' ? 1 : -1) + flat.length) % flat.length,
      );
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const pick = flat[highlighted];
      if (open && pick !== undefined) take(pick);
      return;
    }

    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      setChoosing(false);
    }
  }

  if (value !== null && !choosing) {
    return (
      <button
        type="button"
        onClick={() => {
          setChoosing(true);
          setOpen(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        aria-label={`Cambiar a quién se le anota: ${value.fullName}`}
        className="border-flame bg-surface-2 flex min-h-control w-full cursor-pointer items-center gap-3 rounded-row border-(length:--selectable-border) px-3.5 py-2 text-left"
      >
        <HolderAvatar name={value.fullName} size="sm" on />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-text truncate font-semibold [[data-density=bahia]_&]:text-title">
            {value.fullName}
          </span>
          {value.detail === null ? null : (
            <span className="text-text-faint truncate text-dense">{value.detail}</span>
          )}
        </span>
        <span className="text-flame-text text-dense font-semibold">Cambiar</span>
      </button>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <FieldBox>
        <Label htmlFor={inputId}>¿A quién se le anota?</Label>
        <div className="flex items-center gap-2">
          <Search className="text-text-faint size-icon shrink-0" strokeWidth={1.5} aria-hidden />
          <Input
            ref={inputRef}
            id={inputId}
            className="min-w-0 flex-1"
            type="search"
            value={term}
            onChange={(event) => {
              setTerm(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            autoComplete="off"
            enterKeyHint="search"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              open && flat[highlighted] !== undefined ? optionId(highlighted) : undefined
            }
          />
          {term === '' ? null : (
            <button
              type="button"
              onClick={() => {
                setTerm('');
                inputRef.current?.focus();
              }}
              aria-label="Borrar búsqueda"
              className="text-text-faint hover:bg-surface-3 hover:text-text grid size-touch shrink-0 cursor-pointer place-items-center rounded-control transition-colors duration-(--duration-state) ease-standard"
            >
              <X aria-hidden strokeWidth={1.5} className="size-icon" />
            </button>
          )}
        </div>
      </FieldBox>

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Personas"
          className={cn(
            'border-line bg-surface shadow-dialog absolute inset-x-0 top-[calc(100%+6px)] z-30',
            'flex max-h-[min(360px,55svh)] flex-col gap-0.5 overflow-y-auto rounded-card border p-1.5',
          )}
        >
          {holders.isPending ? (
            <p className="text-text-faint px-3 py-2 text-dense">Cargando…</p>
          ) : holders.error !== null ? (
            <p className="text-danger-text px-3 py-2 text-dense" role="alert">
              {holders.error.message}
            </p>
          ) : flat.length === 0 ? (
            <p className="text-text-faint px-3 py-2 text-dense">Sin resultados</p>
          ) : (
            groups.map((group) =>
              group.options.length === 0 ? null : (
                <div
                  key={group.label}
                  role="group"
                  aria-label={group.label}
                  className="flex flex-col gap-0.5"
                >
                  <HolderGroupLabel>{group.label}</HolderGroupLabel>
                  {group.options.map((option, inGroup) => {
                    const position = group.offset + inGroup;

                    return (
                      <HolderOptionRow
                        key={`${option.kind}:${option.id}`}
                        id={optionId(position)}
                        role="option"
                        tabIndex={-1}
                        aria-selected={position === highlighted}
                        holder={option}
                        active={position === highlighted}
                        onPointerDown={(event) => {
                          // El foco se queda en el campo: el clic elige sin cerrar antes.
                          event.preventDefault();
                        }}
                        onMouseEnter={() => setHighlighted(position)}
                        onClick={() => take(option)}
                        aside={
                          option.openTab === null ? null : (
                            <span className="text-text-dim font-mono text-dense tabular-nums">
                              ${option.openTab.balance}
                            </span>
                          )
                        }
                      />
                    );
                  })}
                </div>
              ),
            )
          )}
        </div>
      ) : null}
    </div>
  );
}
