'use client';

import { useState, type ReactNode } from 'react';

import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { Switch } from '@/components/ui/switch';
import { TimePickerField } from '@/components/ui/time-picker-field';
import { FieldError } from '@/features/inventory/components/form-fields';
import { cn } from '@/lib/utils';

import { civilAtTime } from '../datetime';

/**
 * Piezas de formulario de las rentas (096): fecha con hora, lista y
 * interruptor rotulado. La etiqueta va adentro de la caja y el error afuera
 * (convención 9).
 */

/**
 * Fecha y hora con los selectores propios (119): el calendario y el reloj lado
 * a lado, y el error debajo de los dos. El valor es `YYYY-MM-DDTHH:MM`, o `''`.
 * Elegir solo la fecha deja la hora en 09:00; la hora sola espera a la fecha.
 */
export function DateTimeField({
  id,
  label,
  value,
  onChange,
  error,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  className?: string;
}) {
  const [pendingTime, setPendingTime] = useState('');
  const date = value.slice(0, 10);
  const time = value.slice(11, 16) || pendingTime;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="grid grid-cols-2 gap-2.5 max-[420px]:grid-cols-1">
        <DatePickerField
          id={id}
          label={label}
          value={date}
          onChange={(next) => onChange(next === '' ? '' : civilAtTime(next, time || '09:00'))}
        />
        <TimePickerField
          id={`${id}-time`}
          label="Hora"
          value={time}
          onChange={(next) =>
            date === '' ? setPendingTime(next) : onChange(civilAtTime(date, next))
          }
        />
      </div>
      <FieldError message={error} />
    </div>
  );
}

/** Un `Combobox` de lista corta con su error debajo. */
export function ChoiceField({
  id,
  label,
  options,
  value,
  onChange,
  error,
  placeholder,
  className,
}: {
  id: string;
  label: string;
  options: readonly ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Combobox
        id={id}
        label={label}
        options={options}
        value={value}
        placeholder={placeholder}
        onChange={(next) => onChange(next)}
        invalid={error !== undefined}
      />
      <FieldError message={error} />
    </div>
  );
}

/** Un interruptor con su rótulo y la explicación debajo. A todo el ancho de la rejilla. */
export function SwitchRow({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-(--touch-min) items-center justify-between gap-3 sm:col-span-2 [[data-density=bahia]_&]:col-span-1">
      <label htmlFor={id} className="text-body font-semibold">
        {label}
        {hint === undefined ? null : (
          <span className="text-text-faint block text-dense font-normal">{hint}</span>
        )}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

/** Una fila «rótulo … monto» de un resumen de cobro. */
export function AmountRow({
  label,
  value,
  strong = false,
  tone,
}: {
  label: ReactNode;
  value: ReactNode;
  strong?: boolean;
  tone?: 'danger' | 'go';
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={cn('text-body', strong ? 'font-semibold text-text' : 'text-text-dim')}>
        {label}
      </span>
      <span
        className={cn(
          'font-mono tabular-nums',
          strong && 'font-bold',
          tone === 'danger' && 'text-danger-text',
          tone === 'go' && 'text-go-text',
        )}
      >
        {value}
      </span>
    </div>
  );
}
