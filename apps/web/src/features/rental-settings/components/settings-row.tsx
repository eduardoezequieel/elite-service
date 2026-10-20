'use client';

import { Minus, Plus } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/features/inventory/components/form-fields';
import { cn } from '@/lib/utils';

/**
 * Las piezas de las listas de Ajustes (120): un grupo con su título afuera y
 * filas adentro. Cada fila lleva el rótulo y una ayuda de una línea a la
 * izquierda y el campo a la derecha; en tablet y en bahía, una sola columna.
 * El rótulo vive en la fila y no en la caja, así que estos campos no usan
 * `FieldBox` (excepción anotada en `apps/web/AGENTS.md`, convención 9).
 */

const ICON = 'size-icon';

export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-body [[data-density=bahia]_&]:text-title font-bold">{title}</h2>
      <div className="border-line-soft bg-surface divide-line-soft divide-y rounded-card border">
        {children}
      </div>
    </section>
  );
}

export function SettingsRow({
  label,
  hint,
  htmlFor,
  field,
  children,
}: {
  label: string;
  hint?: string;
  /** El control que enfoca un toque en el rótulo. Sin él, el rótulo es texto. */
  htmlFor?: string;
  /** El campo del formulario: marca su zona en la vista previa de la hoja. */
  field?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-field={field}
      className="grid grid-cols-1 gap-x-6 gap-y-2 px-4.5 py-3.5 xl:grid-cols-[14rem_minmax(0,1fr)] [[data-density=bahia]_&]:grid-cols-1 [[data-density=bahia]_&]:py-4"
    >
      <div className="flex flex-col gap-0.5 xl:pt-2.5 [[data-density=bahia]_&]:pt-0">
        {htmlFor === undefined ? (
          <span className="text-text font-semibold">{label}</span>
        ) : (
          <Label htmlFor={htmlFor} className="text-body">
            {label}
          </Label>
        )}
        {hint === undefined ? null : (
          <p className="text-text-faint text-dense [[data-density=bahia]_&]:text-body">{hint}</p>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">{children}</div>
    </div>
  );
}

/** La caja de un campo con unidad: `$`, `%`, `h`, `N.º`. */
const AFFIX_BOX =
  'border-line bg-surface-2 flex h-control min-w-0 items-center rounded-control border transition-colors duration-(--duration-state) ease-standard focus-within:border-flame has-[[aria-invalid=true]]:border-danger has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-flame-hot has-[:disabled]:opacity-50';

const BARE_INPUT =
  'h-full rounded-none border-0 bg-transparent px-3 focus-visible:outline-none disabled:opacity-100';

function Affix({ children }: { children: ReactNode }) {
  return (
    <span className="text-text-faint shrink-0 px-3 font-semibold whitespace-nowrap select-none">
      {children}
    </span>
  );
}

export function AffixInput({
  before,
  after,
  error,
  short = false,
  mono = false,
  className,
  ...props
}: ComponentProps<'input'> & {
  before?: string;
  after?: string;
  error?: string;
  /** Una cifra corta: la caja no ocupa toda la fila. */
  short?: boolean;
  mono?: boolean;
}) {
  return (
    <>
      <div className={cn(AFFIX_BOX, short && 'max-w-56', className)}>
        {before === undefined ? null : <Affix>{before}</Affix>}
        <Input
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          className={cn(
            BARE_INPUT,
            mono && 'font-mono tabular-nums',
            before !== undefined && 'pl-0',
            after !== undefined && 'pr-1',
          )}
          {...props}
        />
        {after === undefined ? null : <Affix>{after}</Affix>}
      </div>
      <FieldError message={error} />
    </>
  );
}

/**
 * Un entero que se cambia con −/+ (horas de gracia, margen, edad mínima).
 * Los botones miden `--touch-min`; se puede escribir igual.
 */
export function StepperInput({
  value,
  min,
  max,
  unit,
  label,
  error,
  onStep,
  ...props
}: Omit<ComponentProps<'input'>, 'value' | 'min' | 'max'> & {
  value: string;
  min: number;
  max: number;
  unit: string;
  /** El nombre del campo para el lector: «Menos horas de gracia». */
  label: string;
  error?: string;
  onStep: (next: string) => void;
}) {
  const current = Number.parseInt(value, 10);
  const base = Number.isFinite(current) ? current : min;
  const step = (by: number) => onStep(String(Math.min(max, Math.max(min, base + by))));
  const stepClass =
    'text-text-dim hover:bg-surface-2 hover:text-text inline-flex h-full min-w-(--touch-min) shrink-0 items-center justify-center transition-colors duration-(--duration-state) ease-standard disabled:opacity-40';

  return (
    <>
      <div className={cn(AFFIX_BOX, 'max-w-56 overflow-hidden')}>
        <button
          type="button"
          className={stepClass}
          disabled={props.disabled === true || base <= min}
          onClick={() => step(-1)}
        >
          <Minus className={ICON} strokeWidth={1.5} aria-hidden />
          <span className="sr-only">Menos {label}</span>
        </button>
        <Input
          inputMode="numeric"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          value={value}
          className={cn(BARE_INPUT, 'px-0 text-center font-mono tabular-nums')}
          {...props}
        />
        <Affix>{unit}</Affix>
        <button
          type="button"
          className={stepClass}
          disabled={props.disabled === true || base >= max}
          onClick={() => step(1)}
        >
          <Plus className={ICON} strokeWidth={1.5} aria-hidden />
          <span className="sr-only">Más {label}</span>
        </button>
      </div>
      <FieldError message={error} />
    </>
  );
}
