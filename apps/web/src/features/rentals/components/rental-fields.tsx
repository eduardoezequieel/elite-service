'use client';

import type { ComponentProps, ReactNode } from 'react';

import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { FieldError } from '@/features/inventory/components/form-fields';
import { cn } from '@/lib/utils';

/**
 * Piezas de formulario de las rentas (096): fecha con hora, lista y
 * interruptor rotulado. La etiqueta va adentro de la caja y el error afuera
 * (convención 9).
 */

/** Fecha y hora en un `datetime-local`: el selector nativo del celular, que se toca bien. */
export function DateTimeField({
  id,
  label,
  error,
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'type'> & { id: string; label: string; error?: string }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <FieldBox>
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          type="datetime-local"
          step={900}
          className="font-mono tabular-nums"
          aria-invalid={error ? true : undefined}
          {...props}
        />
      </FieldBox>
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
