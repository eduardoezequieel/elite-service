'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  FLEET_CATEGORY_LABELS,
  FLEET_STATUS_LABELS,
  FLEET_VEHICLE_CATEGORIES,
  FLEET_VEHICLE_STATUSES,
  fleetVehicleName,
} from '@elite/shared';
import type { FleetVehicle, FleetVehicleCategory, FleetVehicleStatus } from '@elite/shared';
import { useState } from 'react';
import { Controller, useForm, type Path, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';

import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  FieldError,
  FormAlert,
  TextAreaField,
  TextField,
} from '@/features/inventory/components/form-fields';
import { FormSection } from '@/features/rentals/components/form-section';
import type { ApiError } from '@/lib/api';
import { maskDate } from '@/lib/civil-date';
import { useCreateFleetVehicle, useUpdateFleetVehicle } from '../hooks/use-fleet';
import {
  EMPTY_FLEET_VEHICLE_FORM,
  createFleetVehicleFormSchema,
  fleetVehicleFormValuesOf,
  updateFleetVehicleFormSchema,
  type FleetVehicleFormValues,
} from '../vehicle-form';

const CATEGORY_OPTIONS = FLEET_VEHICLE_CATEGORIES.map((category) => ({
  value: category,
  label: FLEET_CATEGORY_LABELS[category],
}));

const STATUS_OPTIONS = FLEET_VEHICLE_STATUSES.map((status) => ({
  value: status,
  label: FLEET_STATUS_LABELS[status],
}));

type FormFieldName = Path<FleetVehicleFormValues>;

/** Baja los `details` de un 422 o el 409 de placa a su campo; devuelve el mensaje general. */
function applyApiError(
  error: ApiError,
  setError: (name: FormFieldName, error: { message: string }) => void,
): string {
  if (error.code === 'PLATE_TAKEN') setError('plate', { message: error.message });

  if (typeof error.details === 'object' && error.details !== null) {
    for (const [field, message] of Object.entries(error.details as Record<string, unknown>)) {
      if (field in EMPTY_FLEET_VEHICLE_FORM && typeof message === 'string') {
        setError(field as FormFieldName, { message });
      }
    }
  }

  return error.message;
}

/**
 * Alta y edición de un carro de la flota (095), en grupos: identificación,
 * tarifas y km, compra y financiamiento, costos fijos, vencimientos y notas.
 * Los campos del financiamiento aparecen solo si el carro está financiado.
 */
export function FleetVehicleDialog({
  vehicle,
  onClose,
}: {
  /** El carro que se edita; ausente en el alta. */
  vehicle?: FleetVehicle;
  onClose: () => void;
}) {
  const isNew = vehicle === undefined;
  const create = useCreateFleetVehicle();
  const update = useUpdateFleetVehicle();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const createForm = useForm<
    FleetVehicleFormValues,
    unknown,
    z.output<typeof createFleetVehicleFormSchema>
  >({
    resolver: zodResolver(createFleetVehicleFormSchema),
    defaultValues: EMPTY_FLEET_VEHICLE_FORM,
  });
  const updateForm = useForm<
    FleetVehicleFormValues,
    unknown,
    z.output<typeof updateFleetVehicleFormSchema>
  >({
    resolver: zodResolver(updateFleetVehicleFormSchema),
    defaultValues: isNew ? EMPTY_FLEET_VEHICLE_FORM : fleetVehicleFormValuesOf(vehicle),
  });

  const submitCreate = createForm.handleSubmit((input) => {
    setFormError(null);
    create.mutate(input, {
      onSuccess: (saved) => {
        toast({ title: 'Carro creado', description: fleetVehicleName(saved) });
        onClose();
      },
      onError: (error) => setFormError(applyApiError(error, createForm.setError)),
    });
  });

  const submitUpdate = updateForm.handleSubmit((input) => {
    if (vehicle === undefined) return;
    setFormError(null);
    update.mutate(
      { id: vehicle.id, input },
      {
        onSuccess: (saved) => {
          toast({ title: 'Carro guardado', description: fleetVehicleName(saved) });
          onClose();
        },
        onError: (error) => setFormError(applyApiError(error, updateForm.setError)),
      },
    );
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="md:max-w-2xl">
        <form
          noValidate
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={isNew ? submitCreate : submitUpdate}
        >
          <DialogHeader>
            <DialogTitle>{isNew ? 'Nuevo carro' : 'Editar carro'}</DialogTitle>
            <DialogDescription>
              {isNew
                ? 'Nace disponible. Solo marca, modelo y tarifa diaria son obligatorios.'
                : fleetVehicleName(vehicle)}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-6">
            {isNew ? (
              <VehicleFields form={createForm} withStatus={false} />
            ) : (
              <VehicleFields form={updateForm} withStatus />
            )}
            <FormAlert message={formError} />
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={create.isPending || update.isPending}>
              {isNew ? 'Crear carro' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Los campos, comunes al alta y a la edición. Genérico en la salida del schema. */
function VehicleFields<Output>({
  form,
  withStatus,
}: {
  form: UseFormReturn<FleetVehicleFormValues, unknown, Output>;
  /** El alta nace disponible: el estado se elige solo al editar. */
  withStatus: boolean;
}) {
  const errors = form.formState.errors;
  const financed = form.watch('financed');
  const text = (name: FormFieldName) => ({
    error: errors[name]?.message,
    ...form.register(name),
  });
  const money = (name: FormFieldName) => ({
    ...text(name),
    inputMode: 'decimal' as const,
    placeholder: '0.00',
    mono: true,
  });
  const whole = (name: FormFieldName) => ({ ...text(name), inputMode: 'numeric' as const });

  const dateField = (name: FormFieldName, label: string) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <TextField
          id={`fleet-${name}`}
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
    <>
      <FormSection title="Identificación">
        <TextField id="fleet-make" label="Marca" placeholder="Toyota" {...text('make')} />
        <TextField id="fleet-model" label="Modelo" placeholder="Yaris" {...text('model')} />
        <TextField
          id="fleet-plate"
          label="Placa (opcional)"
          placeholder="P53DBC"
          mono
          {...text('plate')}
        />
        <TextField id="fleet-year" label="Año" placeholder="2022" {...whole('year')} />
        <TextField id="fleet-color" label="Color" placeholder="Gris" {...text('color')} />
        <div className="flex flex-col gap-1.5">
          <Controller
            control={form.control}
            name="category"
            render={({ field }) => (
              <Combobox
                id="fleet-category"
                label="Tipo"
                options={CATEGORY_OPTIONS}
                value={field.value}
                onChange={(value) => field.onChange(value as FleetVehicleCategory)}
                onBlur={field.onBlur}
                invalid={errors.category !== undefined}
              />
            )}
          />
          <FieldError message={errors.category?.message} />
        </div>
      </FormSection>

      <FormSection
        title="Tarifas y km"
        hint="La semanal y la mensual son por día y aplican desde 7 y 30 días."
      >
        <TextField id="fleet-daily" label="Tarifa diaria ($)" {...money('dailyRate')} />
        <TextField id="fleet-weekly" label="Por día, 7+ días ($)" {...money('weeklyRate')} />
        <TextField id="fleet-monthly" label="Por día, 30+ días ($)" {...money('monthlyRate')} />
        <TextField
          id="fleet-free-km"
          label="Km libres por día (vacío = ilimitado)"
          {...whole('freeKmPerDay')}
        />
        <TextField id="fleet-extra-km" label="Km adicional ($)" {...money('extraKmPrice')} />
        <TextField id="fleet-odometer" label="Kilometraje actual" {...whole('odometerKm')} />
      </FormSection>

      <FormSection title="Compra y financiamiento">
        <TextField id="fleet-price" label="Precio de compra ($)" {...money('purchasePrice')} />
        {dateField('purchasedAt', 'Fecha de compra')}
        <Controller
          control={form.control}
          name="financed"
          render={({ field }) => (
            <div className="flex min-h-(--touch-min) items-center justify-between gap-3 sm:col-span-2 [[data-density=bahia]_&]:col-span-1">
              <label htmlFor="fleet-financed" className="text-body font-semibold">
                Financiado
                <span className="text-text-faint block text-dense font-normal">
                  Prima, cuota y plazo entran al costo del carro.
                </span>
              </label>
              <Switch id="fleet-financed" checked={field.value} onCheckedChange={field.onChange} />
            </div>
          )}
        />
        {financed ? (
          <>
            <TextField id="fleet-down" label="Prima ($)" {...money('downPayment')} />
            <TextField id="fleet-installment" label="Cuota mensual ($)" {...money('installment')} />
            <TextField id="fleet-term" label="Plazo (meses)" {...whole('termMonths')} />
            {dateField('financingStartedAt', 'Inicio del financiamiento')}
          </>
        ) : null}
      </FormSection>

      <FormSection title="Costos fijos mensuales">
        <TextField id="fleet-insurance" label="Seguro ($)" {...money('insuranceMonthly')} />
        <TextField id="fleet-gps" label="GPS ($)" {...money('gpsMonthly')} />
        <TextField id="fleet-other" label="Otros fijos ($)" {...money('otherFixedMonthly')} />
      </FormSection>

      <FormSection title="Vencimientos">
        {dateField('insuranceExpiresAt', 'Vence el seguro')}
        {dateField('registrationExpiresAt', 'Vence la tarjeta de circulación')}
      </FormSection>

      <FormSection title={withStatus ? 'Estado y notas' : 'Notas'}>
        {withStatus ? (
          <div className="flex flex-col gap-1.5 sm:col-span-2 [[data-density=bahia]_&]:col-span-1">
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <Combobox
                  id="fleet-status"
                  label="Estado"
                  options={STATUS_OPTIONS}
                  value={field.value}
                  onChange={(value) => field.onChange(value as FleetVehicleStatus)}
                  onBlur={field.onBlur}
                />
              )}
            />
          </div>
        ) : null}
        <TextAreaField
          id="fleet-notes"
          label="Notas"
          className="sm:col-span-2 [[data-density=bahia]_&]:col-span-1"
          error={errors.notes?.message}
          {...form.register('notes')}
        />
      </FormSection>
    </>
  );
}
