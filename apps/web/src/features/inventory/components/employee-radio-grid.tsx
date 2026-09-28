'use client';

import type { InventoryEmployeeOption } from '@elite/shared';
import { Check } from 'lucide-react';
import { useId, useRef, type KeyboardEvent } from 'react';

import type { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { radioKeyIndex } from '../picker';

/**
 * A quién se entrega (spec 072): los empleados activos como botones de radio
 * en una grilla —dos columnas en tablet, tres en escritorio—, sin desplegable.
 * Un solo botón entra al tabulador (el elegido o el primero) y las flechas
 * mueven y eligen, como un `radiogroup` de verdad.
 */
export function EmployeeRadioGrid({
  label,
  employees,
  isPending,
  error,
  value,
  onChange,
  onBlur,
  invalid = false,
}: {
  label: string;
  employees: readonly InventoryEmployeeOption[];
  isPending: boolean;
  error: ApiError | null;
  value: string;
  onChange: (id: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
}) {
  const labelId = `${useId()}-label`;
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = employees.findIndex((employee) => employee.id === value);
  const tabStop = selectedIndex < 0 ? 0 : selectedIndex;

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    const next = radioKeyIndex(event.key, index, employees.length);
    if (next === null) return;
    event.preventDefault();
    onChange(employees[next].id);
    buttons.current[next]?.focus();
  }

  return (
    <div className="flex flex-col gap-2">
      <p id={labelId} className="text-text-dim text-label font-medium">
        {label}
      </p>

      {isPending ? (
        <p className="text-text-faint text-dense" role="status">
          Cargando empleados…
        </p>
      ) : error ? (
        <p className="text-danger-text text-dense" role="alert">
          {error.message}
        </p>
      ) : employees.length === 0 ? (
        <p className="text-text-faint text-dense">
          No hay empleados activos. Se dan de alta en Empleados.
        </p>
      ) : (
        <div
          role="radiogroup"
          aria-labelledby={labelId}
          aria-invalid={invalid || undefined}
          className="grid grid-cols-2 gap-2 md:grid-cols-3"
          onBlur={(event) => {
            // Sale del grupo, no de un botón a otro.
            if (!event.currentTarget.contains(event.relatedTarget)) onBlur?.();
          }}
        >
          {employees.map((employee, index) => {
            const selected = employee.id === value;
            return (
              <button
                key={employee.id}
                ref={(node) => {
                  buttons.current[index] = node;
                }}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={index === tabStop ? 0 : -1}
                onClick={() => onChange(employee.id)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                className={cn(
                  'bg-surface-2 flex min-h-touch items-center gap-2 rounded-control border-(length:--selectable-border) px-3 py-2 text-left text-body leading-tight transition-colors duration-(--duration-state) ease-standard',
                  '[[data-density=bahia]_&]:py-3',
                  selected
                    ? 'border-flame text-text font-bold'
                    : cn(
                        'text-text font-semibold hover:border-flame',
                        invalid ? 'border-danger' : 'border-line',
                      ),
                )}
              >
                <span className="min-w-0 flex-1 break-words">{employee.fullName}</span>
                <Check
                  aria-hidden
                  strokeWidth={1.5}
                  className={cn(
                    'text-flame-text size-icon shrink-0',
                    selected ? 'visible' : 'invisible',
                  )}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
