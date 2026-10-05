'use client';

import type { InventoryEmployeeOption } from '@elite/shared';
import { Check, Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

import { Button } from '@/components/ui/button';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { employeesMatching, initialsOf } from '../delivery';

/**
 * «¿A quién?» (spec 091): un buscador con la lista flotante del de la placa
 * (040). Se abre al entrar al campo, filtra con el respiro de la app, sin
 * tildes ni mayúsculas; las flechas recorren, Enter elige el marcado —o el
 * único que queda— y Escape cierra. Elegido, se pliega en una línea con
 * «Cambiar».
 */
export function EmployeeSearchField({
  label,
  employees,
  isPending,
  errorMessage,
  value,
  onChange,
  invalid = false,
}: {
  label: string;
  employees: readonly InventoryEmployeeOption[];
  isPending: boolean;
  errorMessage: string | null;
  value: string | null;
  onChange: (employeeId: string) => void;
  invalid?: boolean;
}) {
  const uid = useId();
  const inputId = `${uid}-search`;
  const listId = `${uid}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [choosing, setChoosing] = useState(value === null);
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [highlighted, setHighlighted] = useState(-1);
  const settled = useDebouncedValue(term);
  const waiting = settled !== term;
  const matches = employeesMatching(employees, settled);
  const chosen = employees.find((employee) => employee.id === value);

  // Tocar afuera cierra la lista, como en la placa.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  // Lo recién asentado arranca marcado en el primero si hay algo escrito.
  useEffect(() => {
    setHighlighted(settled.trim() === '' ? -1 : 0);
  }, [settled]);

  function take(employee: InventoryEmployeeOption): void {
    onChange(employee.id);
    setTerm('');
    setOpen(false);
    setChoosing(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setHighlighted((current) =>
        event.key === 'ArrowDown'
          ? Math.min(current + 1, matches.length - 1)
          : Math.max(current - 1, -1),
      );
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      // Enter no espera el respiro: con lo escrito, elige.
      const now = waiting ? employeesMatching(employees, term) : matches;
      const pick = waiting
        ? now.length === 1
          ? now[0]
          : undefined
        : (now[highlighted] ?? (now.length === 1 ? now[0] : undefined));
      if (pick !== undefined) take(pick);
      return;
    }

    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
    }
  }

  if (chosen !== undefined && !choosing) {
    return (
      <div className="border-line bg-surface-2 flex items-center gap-3 rounded-row border py-2.5 pr-2.5 pl-3.5">
        <Avatar name={chosen.fullName} on />
        <span className="min-w-0 flex-1">
          <span className="text-text-dim block text-dense">{label}</span>
          <span className="text-text block font-semibold [[data-density=bahia]_&]:text-title">
            {chosen.fullName}
          </span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setChoosing(true);
            setOpen(true);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
        >
          Cambiar
        </Button>
      </div>
    );
  }

  const head = isPending
    ? 'Cargando empleados…'
    : errorMessage !== null
      ? errorMessage
      : waiting
        ? 'Buscando…'
        : matches.length === 0
          ? 'Nada encontrado'
          : `${matches.length} ${matches.length === 1 ? 'coincidencia' : 'coincidencias'}`;

  return (
    <div ref={rootRef} className="relative">
      <FieldBox>
        <Label htmlFor={inputId}>{label}</Label>
        <div className="flex items-center gap-2">
          <Search className="text-text-faint size-icon shrink-0" strokeWidth={1.5} aria-hidden />
          <Input
            ref={inputRef}
            id={inputId}
            data-autofocus
            className="min-w-0 flex-1"
            type="search"
            value={term}
            onChange={(event) => {
              setTerm(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Buscá por nombre o apellido"
            autoComplete="off"
            enterKeyHint="search"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-invalid={invalid ? true : undefined}
            // Con la lista abierta, Escape la cierra a ella y no al diálogo.
            data-keeps-escape={open || undefined}
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
          aria-label="Empleados"
          className="border-line bg-surface-2 divide-line-soft absolute inset-x-0 top-[calc(100%+4px)] z-30 max-h-88 divide-y overflow-y-auto rounded-row border"
        >
          <p className="bg-surface-3 text-text-faint sticky top-0 px-4 py-1.5 text-label">{head}</p>
          {isPending || errorMessage !== null
            ? null
            : matches.map((employee, index) => (
                <button
                  key={employee.id}
                  type="button"
                  role="option"
                  aria-selected={index === highlighted}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    take(employee);
                  }}
                  onClick={() => take(employee)}
                  onMouseEnter={() => setHighlighted(index)}
                  className={cn(
                    'hover:bg-surface-3 flex min-h-touch w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left font-semibold transition-colors duration-(--duration-state) ease-standard',
                    '[[data-density=bahia]_&]:px-4.5 [[data-density=bahia]_&]:py-3 [[data-density=bahia]_&]:text-title',
                    index === highlighted && 'bg-surface-3',
                  )}
                >
                  <Avatar name={employee.fullName} on={employee.id === value} small />
                  <span className="text-text min-w-0 flex-1 truncate">{employee.fullName}</span>
                  {employee.id === value ? (
                    <Check
                      className="text-flame-text size-icon shrink-0"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                  ) : null}
                </button>
              ))}
        </div>
      ) : null}
    </div>
  );
}

/** Las iniciales en su círculo. Elegido, lleva el filete de llama. */
function Avatar({
  name,
  on = false,
  small = false,
}: {
  name: string;
  on?: boolean;
  small?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full border font-bold',
        small
          ? 'size-7.5 text-label [[data-density=bahia]_&]:size-9'
          : 'size-9 text-dense [[data-density=bahia]_&]:size-11',
        on ? 'border-flame bg-flame/14 text-flame-text' : 'border-line bg-surface-3 text-text-dim',
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
