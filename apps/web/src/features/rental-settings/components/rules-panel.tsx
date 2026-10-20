'use client';

import type { ReactNode } from 'react';
import { Controller } from 'react-hook-form';

import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';
import { chargeExample, type ChargeExample } from '../charge-example';
import type { RentalSettingsFormValues } from '../settings-form';
import { AffixInput, SettingsGroup, SettingsRow, StepperInput } from './settings-row';
import type { SettingsFormApi } from './settings-form-types';

type StepperField = 'graceHours' | 'bufferHours' | 'minDriverAge';

/** Los topes de `rentalSettingsSchema` (095) para los −/+. */
const STEPPERS: Record<StepperField, { min: number; max: number; unit: string; name: string }> = {
  graceHours: { min: 0, max: 24, unit: 'h', name: 'horas de gracia' },
  bufferHours: { min: 0, max: 72, unit: 'h', name: 'margen entre rentas' },
  minDriverAge: { min: 16, max: 99, unit: 'años', name: 'edad mínima' },
};

/** Cobros y reglas (120): lo que se cobra, el pagaré y los tiempos, con el ejemplo al lado. */
export function RulesPanel({ form, aside }: { form: SettingsFormApi; aside: ReactNode }) {
  const errors = form.formState.errors;

  const stepper = (name: StepperField) => {
    const config = STEPPERS[name];

    return (
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <StepperInput
            id={`rs-${name}`}
            name={field.name}
            ref={field.ref}
            value={field.value}
            min={config.min}
            max={config.max}
            unit={config.unit}
            label={config.name}
            error={errors[name]?.message}
            onChange={(event) => field.onChange(event.target.value)}
            onBlur={field.onBlur}
            onStep={(next) => field.onChange(next)}
          />
        )}
      />
    );
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] xl:gap-8 [[data-density=bahia]_&]:grid-cols-1">
      <div className="flex min-w-0 flex-col gap-7">
        <SettingsGroup title="Lo que se cobra">
          <SettingsRow
            label="CDW"
            hint="Seguro contra daños. Se cobra por día. Vacío: no se ofrece."
            htmlFor="rs-defaultCdwPerDay"
            field="defaultCdwPerDay"
          >
            <AffixInput
              id="rs-defaultCdwPerDay"
              before="$"
              after="/ día"
              short
              mono
              inputMode="decimal"
              placeholder="0.00"
              error={errors.defaultCdwPerDay?.message}
              {...form.register('defaultCdwPerDay')}
            />
          </SettingsRow>
          <SettingsRow
            label="Deducible"
            hint="Lo máximo que paga el cliente si hay daño y tiene CDW."
            htmlFor="rs-defaultDeductible"
            field="defaultDeductible"
          >
            <AffixInput
              id="rs-defaultDeductible"
              before="$"
              short
              mono
              inputMode="decimal"
              placeholder="0.00"
              error={errors.defaultDeductible?.message}
              {...form.register('defaultDeductible')}
            />
          </SettingsRow>
          <SettingsRow
            label="IVA"
            hint="Va incluido en el precio. Ponga 0 si no cobra IVA."
            htmlFor="rs-vatRate"
            field="vatRate"
          >
            <AffixInput
              id="rs-vatRate"
              after="%"
              short
              mono
              inputMode="decimal"
              placeholder="0.00"
              error={errors.vatRate?.message}
              {...form.register('vatRate')}
            />
          </SettingsRow>
        </SettingsGroup>

        <SettingsGroup title="Pagaré">
          <SettingsRow
            label="Interés anual"
            hint="Lo que dice el pagaré que firma el cliente."
            htmlFor="rs-interestRate"
            field="interestRate"
          >
            <AffixInput
              id="rs-interestRate"
              after="%"
              short
              mono
              inputMode="decimal"
              placeholder="0.00"
              error={errors.interestRate?.message}
              {...form.register('interestRate')}
            />
          </SettingsRow>
          <SettingsRow
            label="Interés por atraso"
            hint="Se aplica si no paga a tiempo."
            htmlFor="rs-lateInterestRate"
            field="lateInterestRate"
          >
            <AffixInput
              id="rs-lateInterestRate"
              after="%"
              short
              mono
              inputMode="decimal"
              placeholder="0.00"
              error={errors.lateInterestRate?.message}
              {...form.register('lateInterestRate')}
            />
          </SettingsRow>
        </SettingsGroup>

        <SettingsGroup title="Tiempos y reglas">
          <SettingsRow
            label="Horas de gracia"
            hint="Tiempo extra para devolver sin cobrar otro día."
            htmlFor="rs-graceHours"
            field="graceHours"
          >
            {stepper('graceHours')}
          </SettingsRow>
          <SettingsRow
            label="Margen entre rentas"
            hint="Tiempo para limpiar el carro antes de rentarlo otra vez."
            htmlFor="rs-bufferHours"
            field="bufferHours"
          >
            {stepper('bufferHours')}
          </SettingsRow>
          <SettingsRow
            label="Edad mínima"
            hint="Del conductor principal."
            htmlFor="rs-minDriverAge"
            field="minDriverAge"
          >
            {stepper('minDriverAge')}
          </SettingsRow>
          <SettingsRow
            label="Primer número de contrato"
            hint="Desde aquí sigue la numeración."
            htmlFor="rs-contractStartNumber"
            field="contractStartNumber"
          >
            <AffixInput
              id="rs-contractStartNumber"
              before="N.º"
              short
              mono
              inputMode="numeric"
              error={errors.contractStartNumber?.message}
              {...form.register('contractStartNumber')}
            />
          </SettingsRow>
        </SettingsGroup>
      </div>
      {aside}
    </div>
  );
}

function Line({
  label,
  value,
  muted = false,
  total = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
  total?: boolean;
}) {
  return (
    <>
      <dt
        className={cn(
          total ? 'border-line-soft text-text border-t pt-2 font-bold' : 'text-text-dim',
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          'text-right font-mono tabular-nums',
          muted && 'text-text-faint font-sans',
          total && 'border-line-soft border-t pt-2 font-bold',
        )}
      >
        {value}
      </dd>
    </>
  );
}

/** «Ejemplo: 3 días a $35», con el CDW y el IVA que se están escribiendo. */
export function ChargeExampleCard({
  values,
}: {
  values: Pick<
    RentalSettingsFormValues,
    'defaultCdwPerDay' | 'vatRate' | 'graceHours' | 'bufferHours' | 'contractStartNumber'
  >;
}) {
  const example: ChargeExample = chargeExample(values);
  const rate = formatCents(example.rateCents);

  return (
    <div className="border-line-soft bg-surface flex flex-col gap-3 rounded-card border p-4">
      <h3 className="text-body font-bold">
        Ejemplo: {example.days} días a {rate}
      </h3>
      <dl className="text-body grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5">
        <Line
          label={`Renta (${example.days} × ${rate})`}
          value={formatCents(example.rentalCents)}
        />
        <Line
          label={
            example.cdwPerDayCents > 0
              ? `CDW (${example.days} × ${formatCents(example.cdwPerDayCents)})`
              : 'CDW'
          }
          value={example.cdwPerDayCents > 0 ? formatCents(example.cdwCents) : 'No se cobra'}
          muted={example.cdwPerDayCents === 0}
        />
        <Line label="Total" value={formatCents(example.totalCents)} total />
        <Line
          label={example.vatRate > 0 ? `Incluye IVA ${example.vatRate}%` : 'IVA'}
          value={example.vatRate > 0 ? formatCents(example.vatCents) : 'No se cobra'}
          muted={example.vatRate === 0}
        />
      </dl>
      <p className="border-line-soft text-text-dim text-dense border-t pt-3">
        Si devuelve el carro <b className="text-text">{example.graceHours} h</b> tarde, no paga otro
        día. Después de devolverlo, el carro queda libre en{' '}
        <b className="text-text">{example.bufferHours} h</b>.
        {example.nextContract === '' ? null : (
          <>
            <br />
            Numeración desde{' '}
            <b className="text-text font-mono tabular-nums">N.º {example.nextContract}</b>.
          </>
        )}
      </p>
    </div>
  );
}
