'use client';

import type { PaymentMethod } from '@elite/shared';
import type { ComponentProps, ReactNode } from 'react';

import { TextAreaField, TextField } from '@/features/inventory/components/form-fields';
import { maskDate } from '@/lib/civil-date';
import { formatMoneyCompact } from '@/lib/money';
import { cn } from '@/lib/utils';

import { PAYMENT_METHOD_OPTIONS } from '../agreement-format';
import type { NewRentalValues } from '../new-rental';
import { StepLabel } from './new-rental-car-step';
import { ChoiceField, SwitchRow } from './rental-fields';

const DEPOSIT_METHOD_OPTIONS = [{ value: '', label: 'Sin método' }, ...PAYMENT_METHOD_OPTIONS];

/** Una opción grande de un grupo (`opt` del prototipo): elegida, filete de llama. */
export function OptionButton({
  pressed,
  className,
  children,
  ...props
}: Omit<ComponentProps<'button'>, 'type' | 'aria-pressed'> & {
  pressed: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        'border-line bg-surface-2 text-text flex min-h-[max(var(--control-h),var(--touch-min))] items-center justify-center gap-2 rounded-control border-(length:--selectable-border) px-4 font-semibold',
        'transition-[border-color,background-color] duration-(--duration-state) ease-standard hover:border-flame/55',
        pressed && 'border-flame bg-surface-3',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Paso 3 · Contrato (118): seguro Sí/No con el CDW de ajustes, deducible solo
 * con seguro, descuento, otro conductor, garantía y notas.
 */
export function NewRentalContractStep({
  values,
  onPatch,
  cdwPerDay,
  defaultDeductible,
}: {
  values: NewRentalValues;
  onPatch: (changes: Partial<NewRentalValues>) => void;
  /** El CDW por día de ajustes. */
  cdwPerDay: string;
  defaultDeductible: string | null;
}) {
  const text = (name: keyof NewRentalValues & string) => ({
    value: String(values[name]),
    onChange: (event: { target: { value: string } }) => onPatch({ [name]: event.target.value }),
  });
  const amount = (name: keyof NewRentalValues & string) => ({
    ...text(name),
    inputMode: 'decimal' as const,
    placeholder: '0.00',
    mono: true,
  });
  const typedDate = (name: 'driverLicenseExpiresAt' | 'driverBirthDate') => ({
    value: values[name],
    inputMode: 'numeric' as const,
    placeholder: 'dd/mm/aaaa',
    mono: true,
    onChange: (event: { target: { value: string } }) =>
      onPatch({ [name]: maskDate(event.target.value) }),
  });

  return (
    <>
      <div>
        <StepLabel>Seguro</StepLabel>
        <div className="grid grid-cols-2 gap-2">
          <OptionButton
            pressed={values.insurance}
            onClick={() =>
              onPatch({
                insurance: true,
                deductible:
                  values.deductible === '' ? (defaultDeductible ?? '') : values.deductible,
              })
            }
          >
            Sí · {formatMoneyCompact(cdwPerDay)}/día
          </OptionButton>
          <OptionButton pressed={!values.insurance} onClick={() => onPatch({ insurance: false })}>
            No
          </OptionButton>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
        {values.insurance ? (
          <TextField id="new-rental-deductible" label="Deducible ($)" {...amount('deductible')} />
        ) : null}
        <TextField
          id="new-rental-discount"
          label="Descuento ($)"
          className={
            values.insurance ? undefined : 'sm:col-span-2 [[data-density=bahia]_&]:col-span-1'
          }
          {...amount('discount')}
        />
        <TextField id="new-rental-deposit" label="Garantía" {...amount('deposit')} />
        <ChoiceField
          id="new-rental-deposit-method"
          label="Método"
          options={DEPOSIT_METHOD_OPTIONS}
          value={values.depositMethod}
          onChange={(next) => onPatch({ depositMethod: next as PaymentMethod | '' })}
        />
        <SwitchRow
          id="new-rental-has-driver"
          label="Otro conductor"
          checked={values.hasAdditionalDriver}
          onCheckedChange={(checked) => onPatch({ hasAdditionalDriver: checked })}
        />
        {values.hasAdditionalDriver ? (
          <>
            <TextField id="new-rental-driver-name" label="Nombre" {...text('driverName')} />
            <TextField
              id="new-rental-driver-license"
              label="Licencia"
              mono
              {...text('driverLicenseNumber')}
            />
            <TextField
              id="new-rental-driver-license-expires"
              label="Vence"
              {...typedDate('driverLicenseExpiresAt')}
            />
            <TextField
              id="new-rental-driver-birth"
              label="Nacimiento"
              {...typedDate('driverBirthDate')}
            />
            <TextField id="new-rental-driver-country" label="País" {...text('driverCountry')} />
          </>
        ) : null}
        <TextAreaField
          id="new-rental-notes"
          label="Notas"
          rows={2}
          className="sm:col-span-2 [[data-density=bahia]_&]:col-span-1"
          {...text('notes')}
        />
      </div>
    </>
  );
}
