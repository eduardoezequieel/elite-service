'use client';

import { centsToMoney } from '@elite/shared';
import type { PaymentMethod } from '@elite/shared';
import type { ComponentProps, ReactNode } from 'react';

import { TextAreaField, TextField } from '@/features/inventory/components/form-fields';
import { maskDate } from '@/lib/civil-date';
import { formatMoneyCompact } from '@/lib/money';
import { cn } from '@/lib/utils';

import { PAYMENT_METHOD_OPTIONS } from '../agreement-format';
import { typedCents, type NewRentalValues } from '../new-rental';
import { StepLabel } from './new-rental-car-step';
import { ChoiceField, SwitchRow } from './rental-fields';

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
 * Paso 3 · Contrato (118): «Si choca el carro» (124) con el cargo por día y el
 * deducible de esta renta (ajustes solo los llena la primera vez), descuento,
 * otro conductor, garantía y notas.
 */
export function NewRentalContractStep({
  values,
  onPatch,
  defaultCdwPerDay,
  defaultDeductible,
}: {
  values: NewRentalValues;
  onPatch: (changes: Partial<NewRentalValues>) => void;
  defaultCdwPerDay: string | null;
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
  // El método solo se pide si hay garantía (118).
  const hasDeposit = (typedCents(values.deposit) ?? 0) > 0;
  const typedDate = (name: 'driverLicenseExpiresAt' | 'driverBirthDate') => ({
    value: values[name],
    inputMode: 'numeric' as const,
    placeholder: 'dd/mm/aaaa',
    mono: true,
    onChange: (event: { target: { value: string } }) =>
      onPatch({ [name]: maskDate(event.target.value) }),
  });
  // Sin cobertura elegida, la tarjeta anticipa los valores de ajustes.
  const cdwText = values.insurance ? values.cdwPerDay : (defaultCdwPerDay ?? '');
  const deductibleText = values.insurance ? values.deductible : (defaultDeductible ?? '');
  const cdw = Math.max(0, typedCents(cdwText) ?? 0);
  const deductible = Math.max(0, typedCents(deductibleText) ?? 0);
  const optionClass = 'flex-col items-start gap-0.5 py-2 text-left';

  return (
    <>
      <div>
        <StepLabel>Si choca el carro</StepLabel>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 [[data-density=bahia]_&]:gap-3">
          <OptionButton
            pressed={values.insurance}
            className={optionClass}
            onClick={() =>
              onPatch({
                insurance: true,
                // Lo ya escrito no se pisa (124).
                cdwPerDay: values.cdwPerDay === '' ? (defaultCdwPerDay ?? '') : values.cdwPerDay,
                deductible:
                  values.deductible === '' ? (defaultDeductible ?? '') : values.deductible,
              })
            }
          >
            <span>
              {deductible > 0
                ? `Paga hasta ${formatMoneyCompact(centsToMoney(deductible))}`
                : 'Paga hasta el deducible'}
            </span>
            <span
              className={cn(
                'text-dense',
                cdw > 0 ? 'text-flame-text' : 'text-text-dim font-normal',
              )}
            >
              {cdw > 0 ? `+ ${formatMoneyCompact(centsToMoney(cdw))}/día` : 'Sin cargo'}
            </span>
          </OptionButton>
          <OptionButton
            pressed={!values.insurance}
            className={optionClass}
            onClick={() => onPatch({ insurance: false })}
          >
            <span>Paga todos los daños</span>
            <span className="text-dense text-text-dim font-normal">Sin cargo</span>
          </OptionButton>
        </div>
        {values.insurance ? (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
            <TextField id="new-rental-cdw" label="Cargo por día ($)" {...amount('cdwPerDay')} />
            <TextField
              id="new-rental-deductible"
              label="Paga si choca ($)"
              {...amount('deductible')}
            />
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
        <TextField
          id="new-rental-discount"
          label="Descuento ($)"
          className="sm:col-span-2 [[data-density=bahia]_&]:col-span-1"
          {...amount('discount')}
        />
        <TextField
          id="new-rental-deposit"
          label="Garantía"
          className={hasDeposit ? undefined : 'sm:col-span-2 [[data-density=bahia]_&]:col-span-1'}
          {...amount('deposit')}
        />
        {hasDeposit ? (
          <ChoiceField
            id="new-rental-deposit-method"
            label="Método"
            placeholder="Elija el método"
            options={PAYMENT_METHOD_OPTIONS}
            value={values.depositMethod}
            onChange={(next) => onPatch({ depositMethod: next as PaymentMethod })}
          />
        ) : null}
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
