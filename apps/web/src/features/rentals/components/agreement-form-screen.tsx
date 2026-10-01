'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  PERMISSIONS,
  PICKUP_LOCATIONS,
  RENTAL_COVERAGES,
  RENTAL_COVERAGE_LABELS,
  agreementTotals,
  billableDays,
  moneyToCents,
  rateForDays,
} from '@elite/shared';
import type {
  CheckoutInput,
  CreateAgreementInput,
  PaymentMethod,
  RentalCoverage,
} from '@elite/shared';
import { KeyRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm, type Path } from 'react-hook-form';
import type { z } from 'zod';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { Card, CardSectionHeading } from '@/components/ui/card';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { FormAlert, TextAreaField, TextField } from '@/features/inventory/components/form-fields';
import { useRentalSettings } from '@/features/rental-settings/hooks/use-rental-settings';
import type { ApiError } from '@/lib/api';
import { maskDate } from '@/lib/civil-date';
import { formatMoney } from '@/lib/money';
import { PAYMENT_METHOD_OPTIONS, vehicleTitle } from '../agreement-format';
import {
  AGREEMENT_FORM_FIELDS,
  agreementFormDefaults,
  createAgreementFormSchema,
  type AgreementFormValues,
  type AgreementPrefill,
} from '../agreement-form';
import { fieldToInstant, nowField } from '../datetime';
import { moneyOrNull, wholeOrNull } from '../form-draft';
import { useAvailability, useCreateAgreement } from '../hooks/use-agreements';
import { CustomerField } from './customer-field';
import { FormSection } from './form-section';
import { InspectionWizard } from './inspection-wizard';
import { AmountRow, ChoiceField, DateTimeField, SwitchRow } from './rental-fields';
import { VehicleAvailabilityField } from './vehicle-availability-field';

type FieldName = Path<AgreementFormValues>;

const LOCATION_OPTIONS = PICKUP_LOCATIONS.map((location) => ({ value: location, label: location }));
const COVERAGE_OPTIONS = RENTAL_COVERAGES.map((coverage) => ({
  value: coverage,
  label: RENTAL_COVERAGE_LABELS[coverage],
}));
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
 * Nueva renta (096): cliente, fechas y lugares, carro con la disponibilidad en
 * vivo, cobro, garantía, conductor adicional y observaciones. «Reservar» la
 * deja reservada; «Entregar ahora» abre la entrega y la manda en el mismo paso.
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
  const [delivering, setDelivering] = useState<CreateAgreementInput | null>(null);

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
  const vatRate = settings.data?.vatRate ?? '0.00';
  const money = (text: string, fallback: string) => {
    const amount = moneyOrNull(text);
    return amount !== null && /^\d+(\.\d{1,2})?$/.test(amount) ? amount : fallback;
  };
  const estimate = agreementTotals({
    dailyRate: money(values.dailyRate, suggestedRate ?? '0'),
    cdwPerDay: money(values.cdwPerDay, settings.data?.defaultCdwPerDay ?? '0'),
    billableDays: days,
    extraCharges: money(values.extraCharges, '0'),
    extraKmCharge: '0',
    finesCharged: '0',
    discount: money(values.discount, '0'),
    payments: [],
  });

  function send(input: CreateAgreementInput) {
    setFormError(null);
    create.mutate(input, {
      onSuccess: (saved) => {
        toast({
          title: saved.status === 'IN_PROGRESS' ? 'Carro entregado' : 'Renta reservada',
          description: saved.customer.fullName,
        });
        router.push(`/rentals/agreements/${saved.id}`);
      },
      // Con la entrega abierta, el error se lee ahí mismo (el asistente lo
      // muestra al pie) y lo escrito en la inspección no se pierde.
      onError: (error) => setFormError(applyAgreementError(error, form.setError)),
    });
  }

  const reserve = form.handleSubmit((input) => send(input));
  const deliverNow = form.handleSubmit((input) => {
    setFormError(null);
    setDelivering(input);
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
      <ScreenHeader title="Nueva renta" subtitle="Reservá un carro o entregalo ahora mismo." />

      <form
        noValidate
        onSubmit={reserve}
        className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]"
      >
        <Card className="gap-7 px-card">
          <FormSection title="Cliente">
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
          </FormSection>

          <FormSection title="Fechas y lugares">
            <DateTimeField id="agreement-pickup" label="Sale" {...text('plannedPickupAt')} />
            <DateTimeField id="agreement-return" label="Regresa" {...text('plannedReturnAt')} />
            <Controller
              control={form.control}
              name="pickupLocation"
              render={({ field }) => (
                <ChoiceField
                  id="agreement-pickup-location"
                  label="Lugar de entrega"
                  options={LOCATION_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.pickupLocation?.message}
                />
              )}
            />
            <Controller
              control={form.control}
              name="returnLocation"
              render={({ field }) => (
                <ChoiceField
                  id="agreement-return-location"
                  label="Lugar de devolución"
                  options={LOCATION_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.returnLocation?.message}
                />
              )}
            />
          </FormSection>

          <FormSection title="Carro">
            <Controller
              control={form.control}
              name="vehicleId"
              render={({ field }) => (
                <VehicleAvailabilityField
                  id="agreement-vehicle"
                  from={range?.from ?? null}
                  to={range?.to ?? null}
                  value={field.value}
                  onChange={(vehicleId) => field.onChange(vehicleId)}
                  error={errors.vehicleId?.message}
                />
              )}
            />
          </FormSection>

          <FormSection
            title="Cobro"
            hint="Vacíos, la tarifa por tramo del carro, los días con la gracia de ajustes y el CDW de ajustes."
          >
            <TextField
              id="agreement-rate"
              label="Tarifa por día ($)"
              {...amount('dailyRate')}
              placeholder={suggestedRate ?? '0.00'}
            />
            <TextField
              id="agreement-days"
              label="Días a cobrar"
              inputMode="numeric"
              mono
              {...text('billableDays')}
              placeholder={computedDays === null ? '—' : String(computedDays)}
            />
            <TextField
              id="agreement-cdw"
              label="CDW por día ($)"
              {...amount('cdwPerDay')}
              placeholder={settings.data?.defaultCdwPerDay ?? '0.00'}
            />
            <TextField
              id="agreement-deductible"
              label="Deducible ($)"
              {...amount('deductible')}
              placeholder={settings.data?.defaultDeductible ?? '0.00'}
            />
            <Controller
              control={form.control}
              name="coverage"
              render={({ field }) => (
                <ChoiceField
                  id="agreement-coverage"
                  label="Cobertura"
                  options={COVERAGE_OPTIONS}
                  value={field.value}
                  onChange={(next) => field.onChange(next as RentalCoverage)}
                />
              )}
            />
            {moneyToCents(vatRate) > 0 ? (
              <Controller
                control={form.control}
                name="includesVat"
                render={({ field }) => (
                  <SwitchRow
                    id="agreement-vat"
                    label="IVA incluido"
                    hint={`La tarifa ya trae el ${vatRate} % de IVA.`}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            ) : null}
            <TextField id="agreement-extras" label="Cargos extra ($)" {...amount('extraCharges')} />
            <TextField
              id="agreement-extras-note"
              label="Detalle de los cargos"
              placeholder="Silla de bebé"
              {...text('extraChargesNote')}
            />
            <TextField id="agreement-discount" label="Descuento ($)" {...amount('discount')} />
          </FormSection>

          <FormSection title="Garantía" hint="De la tarjeta, solo los últimos 4 dígitos.">
            <TextField id="agreement-deposit" label="Depósito ($)" {...amount('deposit')} />
            <Controller
              control={form.control}
              name="depositMethod"
              render={({ field }) => (
                <ChoiceField
                  id="agreement-deposit-method"
                  label="Método del depósito"
                  options={DEPOSIT_METHOD_OPTIONS}
                  value={field.value}
                  onChange={(next) => field.onChange(next as PaymentMethod | '')}
                />
              )}
            />
            <TextField
              id="agreement-card"
              label="Tarjeta, últimos 4"
              inputMode="numeric"
              maxLength={4}
              mono
              {...text('cardLast4')}
            />
            <TextField
              id="agreement-auth-code"
              label="Código de autorización"
              mono
              {...text('authorizationCode')}
            />
            <TextField
              id="agreement-auth-amount"
              label="Monto autorizado ($)"
              {...amount('authorizationAmount')}
            />
            {typedDate('authorizationDate', 'Fecha de autorización')}
          </FormSection>

          <FormSection title="Conductor adicional">
            <Controller
              control={form.control}
              name="hasAdditionalDriver"
              render={({ field }) => (
                <SwitchRow
                  id="agreement-has-driver"
                  label="Hay otro conductor"
                  hint="Queda registrado y autorizado en el contrato."
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
                {typedDate('driverLicenseExpiresAt', 'Vence la licencia')}
                {typedDate('driverBirthDate', 'Nacimiento')}
                <TextField id="agreement-driver-country" label="País" {...text('driverCountry')} />
              </>
            ) : null}
          </FormSection>

          <FormSection title="Observaciones">
            <TextAreaField
              id="agreement-notes"
              label="Notas"
              className="sm:col-span-2 [[data-density=bahia]_&]:col-span-1"
              error={errors.notes?.message}
              {...form.register('notes')}
            />
          </FormSection>
        </Card>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start">
          <Card className="gap-3 px-card">
            <CardSectionHeading aside={computedDays === null ? undefined : `${days} días`}>
              Resumen
            </CardSectionHeading>
            <p className="text-text-dim text-body">
              {row === undefined ? 'Sin carro elegido' : vehicleTitle(row.vehicle)}
            </p>
            <AmountRow label="Renta" value={formatMoney(estimate.rental)} />
            <AmountRow label="Total estimado" value={formatMoney(estimate.total)} strong />
            <FormAlert message={formError} />
            <div className="flex flex-col gap-2">
              <Button
                type="submit"
                size="lg"
                className="w-full"
                loading={create.isPending && delivering === null}
              >
                Reservar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => void deliverNow()}
              >
                <KeyRound className="size-icon text-text-faint" strokeWidth={1.5} aria-hidden />
                Entregar ahora
              </Button>
            </div>
          </Card>
        </aside>
      </form>

      {delivering === null ? null : (
        <InspectionWizard
          mode="checkout"
          context={{
            vehicleOdometerKm: row?.vehicle.odometerKm ?? 0,
            pickupInspection: null,
            pickupOdometerKm: null,
            deposit: delivering.deposit,
            depositMethod: delivering.depositMethod ?? null,
            depositHeld: '0.00',
          }}
          vehicle={{
            label:
              row === undefined
                ? 'Carro'
                : `${vehicleTitle(row.vehicle)} · ${row.vehicle.plate ?? 'sin placa'}`,
            freeKmPerDay: row?.vehicle.freeKmPerDay ?? null,
            extraKmPrice: row?.vehicle.extraKmPrice ?? null,
          }}
          initialAt={values.plannedPickupAt || nowField()}
          estimatedTotal={estimate.total}
          pending={create.isPending}
          error={formError}
          onClose={() => setDelivering(null)}
          onSubmit={(checkout: CheckoutInput) =>
            send({ ...delivering, checkoutNow: true, checkout })
          }
        />
      )}
    </div>
  );
}
