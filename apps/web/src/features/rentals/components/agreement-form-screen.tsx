'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { PERMISSIONS, agreementTotals, billableDays, rateForDays } from '@elite/shared';
import type { CreateAgreementInput, PaymentMethod, RentalCoverage } from '@elite/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm, type Path } from 'react-hook-form';
import type { z } from 'zod';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { FormAlert, TextAreaField, TextField } from '@/features/inventory/components/form-fields';
import { useRentalSettings } from '@/features/rental-settings/hooks/use-rental-settings';
import type { ApiError } from '@/lib/api';
import { maskDate } from '@/lib/civil-date';
import { PAYMENT_METHOD_OPTIONS } from '../agreement-format';
import {
  AGREEMENT_FORM_FIELDS,
  agreementFormDefaults,
  createAgreementFormSchema,
  deliversNow,
  writtenRentalTotal,
  type AgreementFormValues,
  type AgreementPrefill,
} from '../agreement-form';
import { fieldToInstant } from '../datetime';
import { moneyOrNull, wholeOrNull } from '../form-draft';
import { useAvailability, useCreateAgreement } from '../hooks/use-agreements';
import { CustomerField } from './customer-field';
import { ChoiceField, DateTimeField, SwitchRow } from './rental-fields';
import { VehicleAvailabilityField } from './vehicle-availability-field';

type FieldName = Path<AgreementFormValues>;

const DEPOSIT_METHOD_OPTIONS = [{ value: '', label: 'Sin método' }, ...PAYMENT_METHOD_OPTIONS];

/** Si los ajustes no llegaron, la gracia del prototipo. */
const DEFAULT_GRACE_HOURS = 1;

/** Baja un `ApiError` a sus campos y devuelve el mensaje general. */
export function applyAgreementError(
  error: ApiError,
  setError: (name: FieldName, error: { message: string }) => void,
): string {
  if (error.code === 'VEHICLE_UNAVAILABLE' || error.code === 'VEHICLE_NOT_RENTABLE') {
    setError('vehicleId', { message: error.message });
  }
  if (error.code === 'RENTER_BLOCKED') setError('customerId', { message: error.message });

  if (typeof error.details === 'object' && error.details !== null) {
    for (const [field, message] of Object.entries(error.details as Record<string, unknown>)) {
      if ((AGREEMENT_FORM_FIELDS as string[]).includes(field) && typeof message === 'string') {
        setError(field as FieldName, { message });
      }
    }
  }

  return error.message;
}

/**
 * Nueva renta (108): cliente, salida, regreso y carro. El resto del contrato
 * va plegado. Un solo primario: «Entregar ahora» si sale hoy, si no «Reservar».
 */
export function AgreementFormScreen({ prefill }: { prefill: AgreementPrefill }) {
  const router = useRouter();
  const { toast } = useToast();
  const { canAny } = usePermissions();
  const settings = useRentalSettings(
    canAny(PERMISSIONS.rentals.actions.read.key, PERMISSIONS.rentals.actions.settings.key),
  );
  const create = useCreateAgreement();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<AgreementFormValues, unknown, z.output<typeof createAgreementFormSchema>>({
    resolver: zodResolver(createAgreementFormSchema),
    defaultValues: agreementFormDefaults(prefill),
  });
  const { errors } = form.formState;
  const values = form.watch();

  const pickup = fieldToInstant(values.plannedPickupAt);
  const returnAt = fieldToInstant(values.plannedReturnAt);
  const range =
    pickup !== null && returnAt !== null && returnAt > pickup
      ? { from: pickup, to: returnAt }
      : null;
  const availability = useAvailability(range);
  const row = availability.data?.find((candidate) => candidate.vehicle.id === values.vehicleId);

  const graceHours = settings.data?.graceHours ?? DEFAULT_GRACE_HOURS;
  const computedDays = range === null ? null : billableDays(range.from, range.to, graceHours);
  const typedDays = wholeOrNull(values.billableDays);
  const days = typeof typedDays === 'number' && typedDays > 0 ? typedDays : (computedDays ?? 1);
  const suggestedRate = row === undefined ? null : rateForDays(row.vehicle, days);
  const money = (text: string, fallback: string) => {
    const amount = moneyOrNull(text);
    return amount !== null && /^\d+(\.\d{1,2})?$/.test(amount) ? amount : fallback;
  };
  const dailyRate = money(values.dailyRate, suggestedRate ?? '0');
  const estimate = agreementTotals({
    dailyRate,
    cdwPerDay: money(values.cdwPerDay, settings.data?.defaultCdwPerDay ?? '0'),
    billableDays: days,
    extraCharges: money(values.extraCharges, '0'),
    extraKmCharge: '0',
    finesCharged: '0',
    discount: money(values.discount, '0'),
    payments: [],
  });
  const now = deliversNow(values.plannedPickupAt);

  const submit = form.handleSubmit((input: CreateAgreementInput) => {
    setFormError(null);
    create.mutate(input, {
      onSuccess: (saved) => {
        toast({
          title: now ? 'Lista para entregar' : 'Renta reservada',
          description: saved.customer.fullName,
        });
        router.push(
          now ? `/rentals/agreements/${saved.id}?action=deliver` : `/rentals/agreements/${saved.id}`,
        );
      },
      onError: (error) => setFormError(applyAgreementError(error, form.setError)),
    });
  });

  const text = (name: FieldName) => ({ error: errors[name]?.message, ...form.register(name) });
  const amount = (name: FieldName) => ({
    ...text(name),
    inputMode: 'decimal' as const,
    placeholder: '0.00',
    mono: true,
  });
  const typedDate = (name: FieldName, label: string) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <TextField
          id={`agreement-${name}`}
          label={label}
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          mono
          error={errors[name]?.message}
          name={field.name}
          value={String(field.value)}
          onBlur={field.onBlur}
          onChange={(event) => field.onChange(maskDate(event.target.value))}
        />
      )}
    />
  );

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader title="Nueva renta" />

      <form noValidate onSubmit={submit} className="flex max-w-3xl flex-col gap-5">
        <Controller
          control={form.control}
          name="customerId"
          render={({ field }) => (
            <CustomerField
              value={field.value}
              onChange={field.onChange}
              error={errors.customerId?.message}
            />
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
          <DateTimeField id="agreement-pickup" label="Sale" {...text('plannedPickupAt')} />
          <DateTimeField id="agreement-return" label="Regresa" {...text('plannedReturnAt')} />
        </div>

        <Controller
          control={form.control}
          name="vehicleId"
          render={({ field }) => (
            <VehicleAvailabilityField
              id="agreement-vehicle"
              label="Carro"
              freeOnly
              from={range?.from ?? null}
              to={range?.to ?? null}
              value={field.value}
              onChange={(vehicleId) => field.onChange(vehicleId)}
              error={errors.vehicleId?.message}
            />
          )}
        />

        <p className="text-title tabular-nums">
          {writtenRentalTotal(row === undefined ? null : dailyRate, days, estimate.total, {
            cdwPerDay: money(values.cdwPerDay, settings.data?.defaultCdwPerDay ?? '0'),
            discount: money(values.discount, '0'),
          })}
        </p>

        <details className="border-line-soft rounded-row border">
          <summary className="min-h-(--touch-min) cursor-pointer px-4 py-3 text-body font-semibold">
            Más datos del contrato
          </summary>
          <div className="grid grid-cols-1 gap-4 px-4 pb-4 sm:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
            <Controller
              control={form.control}
              name="coverage"
              render={({ field }) => (
                <SwitchRow
                  id="agreement-coverage"
                  label="Seguro"
                  checked={field.value === 'ACCEPTED'}
                  onCheckedChange={(checked) =>
                    field.onChange((checked ? 'ACCEPTED' : 'DECLINED') as RentalCoverage)
                  }
                />
              )}
            />
            <TextField
              id="agreement-cdw"
              label="CDW por día"
              {...amount('cdwPerDay')}
              placeholder={settings.data?.defaultCdwPerDay ?? '0.00'}
            />
            <TextField
              id="agreement-deductible"
              label="Deducible"
              {...amount('deductible')}
              placeholder={settings.data?.defaultDeductible ?? '0.00'}
            />
            <TextField id="agreement-discount" label="Descuento" {...amount('discount')} />
            <TextField id="agreement-deposit" label="Garantía" {...amount('deposit')} />
            <Controller
              control={form.control}
              name="depositMethod"
              render={({ field }) => (
                <ChoiceField
                  id="agreement-deposit-method"
                  label="Método"
                  options={DEPOSIT_METHOD_OPTIONS}
                  value={field.value}
                  onChange={(next) => field.onChange(next as PaymentMethod | '')}
                />
              )}
            />
            <Controller
              control={form.control}
              name="hasAdditionalDriver"
              render={({ field }) => (
                <SwitchRow
                  id="agreement-has-driver"
                  label="Otro conductor"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            {values.hasAdditionalDriver ? (
              <>
                <TextField id="agreement-driver-name" label="Nombre" {...text('driverName')} />
                <TextField
                  id="agreement-driver-license"
                  label="Licencia"
                  mono
                  {...text('driverLicenseNumber')}
                />
                {typedDate('driverLicenseExpiresAt', 'Vence')}
                {typedDate('driverBirthDate', 'Nacimiento')}
                <TextField id="agreement-driver-country" label="País" {...text('driverCountry')} />
              </>
            ) : null}
            <TextAreaField
              id="agreement-notes"
              label="Notas"
              className="sm:col-span-2 [[data-density=bahia]_&]:col-span-1"
              error={errors.notes?.message}
              {...form.register('notes')}
            />
          </div>
        </details>

        <FormAlert message={formError} />
        <Button type="submit" size="lg" className="w-full sm:w-fit" loading={create.isPending}>
          {now ? 'Entregar ahora' : 'Reservar'}
        </Button>
      </form>
    </div>
  );
}
