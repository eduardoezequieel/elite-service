'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { PERMISSIONS } from '@elite/shared';
import type { RentalSettings } from '@elite/shared';
import { useState, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { Card, CardSectionHeading } from '@/components/ui/card';
import { DetailSkeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import {
  FieldError,
  FormAlert,
  TextAreaField,
  TextField,
} from '@/features/inventory/components/form-fields';
import type { ApiError } from '@/lib/api';
import { useRentalSettings, useSaveRentalSettings } from '../hooks/use-rental-settings';
import {
  rentalSettingsFormSchema,
  settingsFormValuesOf,
  type RentalSettingsFormValues,
} from '../settings-form';
import { EditableTextList } from './editable-text-list';
import { LogoField } from './logo-field';

/** Los campos de texto del formulario: los que se escriben en un `TextField`. */
type FormFieldName = Exclude<
  keyof RentalSettingsFormValues,
  'clauses' | 'accessories' | 'logoFileId'
>;

const GRID =
  'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 [[data-density=bahia]_&]:sm:grid-cols-1 [[data-density=bahia]_&]:md:grid-cols-2 [[data-density=bahia]_&]:xl:grid-cols-2';

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: string;
  children: ReactNode;
}) {
  return (
    <Card className="gap-4 px-card">
      <CardSectionHeading aside={aside}>{title}</CardSectionHeading>
      {children}
    </Card>
  );
}

/**
 * Ajustes de la rentadora (095): empresa y logo, valores del contrato, texto
 * del contrato con sus cláusulas, y la lista de accesorios. Los km y los días
 * de aviso viven en el plan de servicio (110) y viajan ocultos para que el
 * `PUT` de la fila entera no los borre.
 */
export function RentalSettingsScreen() {
  const settings = useRentalSettings();

  if (settings.isPending) return <DetailSkeleton label="Cargando los ajustes" />;

  if (settings.error !== null || settings.data === undefined) {
    return (
      <p className="text-danger-text text-body" role="alert">
        {settings.error?.message ?? 'No se pudieron cargar los ajustes.'}
      </p>
    );
  }

  return <SettingsForm key={settings.data.updatedAt} settings={settings.data} />;
}

function SettingsForm({ settings }: { settings: RentalSettings }) {
  const { can } = usePermissions();
  const canEdit = can(PERMISSIONS.rentals.actions.settings.key);
  const save = useSaveRentalSettings();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<
    RentalSettingsFormValues,
    unknown,
    z.output<typeof rentalSettingsFormSchema>
  >({
    resolver: zodResolver(rentalSettingsFormSchema),
    defaultValues: settingsFormValuesOf(settings),
  });
  const errors = form.formState.errors;
  const field = (name: FormFieldName, mono = false) => ({
    error: errors[name]?.message,
    mono,
    ...form.register(name),
  });
  const numeric = (name: FormFieldName) => ({
    ...field(name, true),
    inputMode: 'numeric' as const,
  });
  const decimal = (name: FormFieldName) => ({
    ...field(name, true),
    inputMode: 'decimal' as const,
  });

  function onApiError(error: ApiError): void {
    if (typeof error.details === 'object' && error.details !== null) {
      for (const [name, message] of Object.entries(error.details as Record<string, unknown>)) {
        if (typeof message === 'string') {
          form.setError(name.split('.')[0] as keyof RentalSettingsFormValues, { message });
        }
      }
    }
    setFormError(error.message);
  }

  const submit = form.handleSubmit((input) => {
    setFormError(null);
    save.mutate(input, {
      onSuccess: () => toast({ title: 'Ajustes guardados', description: input.companyName }),
      onError: onApiError,
    });
  });

  const saveButton = canEdit ? (
    <Button type="submit" form="rental-settings-form" loading={save.isPending}>
      Guardar ajustes
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader title="Ajustes" subtitle="Datos de la empresa y del contrato de renta">
        {saveButton}
      </ScreenHeader>

      <form id="rental-settings-form" noValidate onSubmit={submit} className="flex flex-col gap-4">
        <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-4">
          <Section title="Empresa">
            <Controller
              control={form.control}
              name="logoFileId"
              render={({ field: control }) => (
                <LogoField
                  logoFileId={control.value}
                  logoUrl={settings.logoUrl}
                  onChange={control.onChange}
                />
              )}
            />
            <div className={GRID}>
              <TextField id="rs-company" label="Nombre de la empresa" {...field('companyName')} />
              <TextField id="rs-tax-id" label="NIT" {...field('taxId', true)} />
              <TextField id="rs-nrc" label="NRC" {...field('nrc', true)} />
              <TextField id="rs-lessor" label="Arrendante" {...field('lessorName')} />
              <TextField id="rs-phones" label="Teléfonos" {...field('phones')} />
              <TextField id="rs-email" label="Correo" inputMode="email" {...field('email')} />
              <TextField id="rs-city" label="Ciudad del contrato" {...field('city')} />
            </div>
            <TextAreaField
              id="rs-address"
              label="Dirección"
              rows={2}
              error={errors.address?.message}
              {...form.register('address')}
            />
          </Section>

          <Section title="Contrato">
            <div className={GRID}>
              <TextField
                id="rs-contract-start"
                label="Número de contrato inicial"
                {...numeric('contractStartNumber')}
              />
              <TextField id="rs-vat" label="IVA (%)" {...decimal('vatRate')} />
              <TextField id="rs-cdw" label="CDW por día ($)" {...decimal('defaultCdwPerDay')} />
              <TextField
                id="rs-deductible"
                label="Deducible ($)"
                {...decimal('defaultDeductible')}
              />
              <TextField
                id="rs-buffer"
                label="Margen entre rentas (horas)"
                {...numeric('bufferHours')}
              />
              <TextField id="rs-grace" label="Horas de gracia" {...numeric('graceHours')} />
              <TextField id="rs-min-age" label="Edad mínima" {...numeric('minDriverAge')} />
              <TextField id="rs-interest" label="Interés (%)" {...decimal('interestRate')} />
              <TextField
                id="rs-late-interest"
                label="Interés moratorio (%)"
                {...decimal('lateInterestRate')}
              />
            </div>
          </Section>

          <input type="hidden" {...form.register('kmAlert')} />
          <input type="hidden" {...form.register('daysAlert')} />

          <Section title="Texto del contrato" aside="{ARRENDANTE} se reemplaza al imprimir">
            <TextAreaField
              id="rs-intro"
              label="Introducción"
              rows={4}
              error={errors.contractIntro?.message}
              {...form.register('contractIntro')}
            />
            <Controller
              control={form.control}
              name="clauses"
              render={({ field: control }) => (
                <EditableTextList
                  id="rs-clause"
                  items={control.value}
                  onChange={control.onChange}
                  itemLabel="Cláusula"
                  addLabel="Agregar cláusula"
                  multiline
                />
              )}
            />
            <FieldError message={errors.clauses?.message ?? errors.clauses?.root?.message} />
          </Section>

          <Section title="Accesorios" aside="Lo que se revisa al entregar y recibir">
            <Controller
              control={form.control}
              name="accessories"
              render={({ field: control }) => (
                <EditableTextList
                  id="rs-accessory"
                  items={control.value}
                  onChange={control.onChange}
                  itemLabel="Accesorio"
                  addLabel="Agregar accesorio"
                />
              )}
            />
            <FieldError
              message={errors.accessories?.message ?? errors.accessories?.root?.message}
            />
          </Section>
        </fieldset>

        <FormAlert message={formError} />

        {saveButton === null ? null : (
          <div className="flex justify-end max-sm:[&>*]:w-full">{saveButton}</div>
        )}
      </form>
    </div>
  );
}
