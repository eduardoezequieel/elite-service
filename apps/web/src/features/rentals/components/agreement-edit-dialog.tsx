'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { PICKUP_LOCATIONS, RENTAL_COVERAGES, RENTAL_COVERAGE_LABELS } from '@elite/shared';
import type { PaymentMethod, RentalAgreement, RentalCoverage } from '@elite/shared';
import { useMemo, useState } from 'react';
import { Controller, useForm, type Path } from 'react-hook-form';
import type { z } from 'zod';

import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormAlert, TextAreaField, TextField } from '@/features/inventory/components/form-fields';
import { PAYMENT_METHOD_OPTIONS } from '../agreement-format';
import {
  agreementFormValuesOf,
  updateAgreementFormSchema,
  type AgreementFormValues,
} from '../agreement-form';
import { useUpdateAgreement } from '../hooks/use-agreements';
import { applyAgreementError } from './agreement-form-screen';
import { FormSection } from './form-section';
import { ChoiceField, DateTimeField } from './rental-fields';

const LOCATION_OPTIONS = PICKUP_LOCATIONS.map((location) => ({ value: location, label: location }));
const COVERAGE_OPTIONS = RENTAL_COVERAGES.map((coverage) => ({
  value: coverage,
  label: RENTAL_COVERAGE_LABELS[coverage],
}));
const DEPOSIT_METHOD_OPTIONS = [{ value: '', label: 'Sin método' }, ...PAYMENT_METHOD_OPTIONS];

/**
 * Editar una renta reservada o en curso (096): fechas (la salida solo
 * mientras está reservada), lugares, cobro, garantía y notas. Viaja solo lo
 * que cambió; mover las fechas revalida los choques en el API.
 */
export function AgreementEditDialog({
  agreement,
  onClose,
}: {
  agreement: RentalAgreement;
  onClose: () => void;
}) {
  const reserved = agreement.status === 'RESERVED';
  const original = useMemo(() => agreementFormValuesOf(agreement), [agreement]);
  const schema = useMemo(() => updateAgreementFormSchema(original, reserved), [original, reserved]);
  const update = useUpdateAgreement();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<AgreementFormValues, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: original,
  });
  const errors = form.formState.errors;
  const text = (name: Path<AgreementFormValues>) => ({
    error: errors[name]?.message,
    ...form.register(name),
  });
  const amount = (name: Path<AgreementFormValues>) => ({
    ...text(name),
    inputMode: 'decimal' as const,
    placeholder: '0.00',
    mono: true,
  });

  const submit = form.handleSubmit((input) => {
    setFormError(null);
    if (Object.keys(input).length === 0) {
      onClose();
      return;
    }
    update.mutate(
      { id: agreement.id, input },
      {
        onSuccess: () => {
          toast({ title: 'Renta guardada', description: agreement.customer.fullName });
          onClose();
        },
        onError: (error) => setFormError(applyAgreementError(error, form.setError)),
      },
    );
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="md:max-w-2xl">
        <form noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Editar la renta</DialogTitle>
            <DialogDescription>
              {agreement.customer.fullName} · {agreement.vehicle.plate ?? 'sin placa'}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-6">
            <FormSection title="Fechas y lugares">
              {reserved ? (
                <DateTimeField id="edit-pickup" label="Sale" {...text('plannedPickupAt')} />
              ) : null}
              <DateTimeField id="edit-return" label="Regresa" {...text('plannedReturnAt')} />
              <Controller
                control={form.control}
                name="pickupLocation"
                render={({ field }) => (
                  <ChoiceField
                    id="edit-pickup-location"
                    label="Lugar de entrega"
                    options={LOCATION_OPTIONS}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="returnLocation"
                render={({ field }) => (
                  <ChoiceField
                    id="edit-return-location"
                    label="Lugar de devolución"
                    options={LOCATION_OPTIONS}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </FormSection>

            <FormSection
              title="Cobro"
              hint="Si movés las fechas sin tocar los días, se recalculan."
            >
              <TextField id="edit-rate" label="Tarifa por día ($)" {...amount('dailyRate')} />
              <TextField
                id="edit-days"
                label="Días a cobrar"
                inputMode="numeric"
                mono
                {...text('billableDays')}
              />
              <TextField id="edit-cdw" label="CDW por día ($)" {...amount('cdwPerDay')} />
              <TextField id="edit-deductible" label="Deducible ($)" {...amount('deductible')} />
              <Controller
                control={form.control}
                name="coverage"
                render={({ field }) => (
                  <ChoiceField
                    id="edit-coverage"
                    label="Cobertura"
                    options={COVERAGE_OPTIONS}
                    value={field.value}
                    onChange={(next) => field.onChange(next as RentalCoverage)}
                  />
                )}
              />
              <TextField id="edit-extras" label="Cargos extra ($)" {...amount('extraCharges')} />
              <TextField
                id="edit-extras-note"
                label="Detalle de los cargos"
                {...text('extraChargesNote')}
              />
              <TextField id="edit-discount" label="Descuento ($)" {...amount('discount')} />
            </FormSection>

            <FormSection title="Garantía">
              <TextField id="edit-deposit" label="Depósito ($)" {...amount('deposit')} />
              <Controller
                control={form.control}
                name="depositMethod"
                render={({ field }) => (
                  <ChoiceField
                    id="edit-deposit-method"
                    label="Método del depósito"
                    options={DEPOSIT_METHOD_OPTIONS}
                    value={field.value}
                    onChange={(next) => field.onChange(next as PaymentMethod | '')}
                  />
                )}
              />
              <TextField
                id="edit-card"
                label="Tarjeta, últimos 4"
                inputMode="numeric"
                maxLength={4}
                mono
                {...text('cardLast4')}
              />
              <TextField
                id="edit-auth-code"
                label="Código de autorización"
                mono
                {...text('authorizationCode')}
              />
              <TextField
                id="edit-auth-amount"
                label="Monto autorizado ($)"
                {...amount('authorizationAmount')}
              />
            </FormSection>

            <FormSection title="Observaciones">
              <TextAreaField
                id="edit-notes"
                label="Notas"
                className="sm:col-span-2 [[data-density=bahia]_&]:col-span-1"
                error={errors.notes?.message}
                {...form.register('notes')}
              />
            </FormSection>

            <FormAlert message={formError} />
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={update.isPending}>
              Guardar cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
