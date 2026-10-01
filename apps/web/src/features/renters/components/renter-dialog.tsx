'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Renter } from '@elite/shared';
import { useState } from 'react';
import { Controller, useForm, type Path, type UseFormReturn } from 'react-hook-form';
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
import { Switch } from '@/components/ui/switch';
import { FormAlert, TextAreaField, TextField } from '@/features/inventory/components/form-fields';
import { FormSection } from '@/features/rentals/components/form-section';
import type { ApiError } from '@/lib/api';
import { maskDate } from '@/lib/civil-date';
import { useCreateRenter, useUpdateRenter } from '../hooks/use-renters';
import {
  EMPTY_RENTER_FORM,
  createRenterFormSchema,
  renterFormValuesOf,
  updateRenterFormSchema,
  type RenterFormValues,
} from '../renter-form';

type FormFieldName = Path<RenterFormValues>;

function applyApiError(
  error: ApiError,
  setError: (name: FormFieldName, error: { message: string }) => void,
): string {
  if (typeof error.details === 'object' && error.details !== null) {
    for (const [field, message] of Object.entries(error.details as Record<string, unknown>)) {
      if (field in EMPTY_RENTER_FORM && typeof message === 'string') {
        setError(field as FormFieldName, { message });
      }
    }
  }

  return error.message;
}

/**
 * Alta y edición de un cliente de renta (095), con lo que pide el contrato:
 * documento, licencia y su vencimiento, nacimiento y país. «No rentar» pide
 * motivo; en la edición, además, se desactiva.
 */
export function RenterDialog({ renter, onClose }: { renter?: Renter; onClose: () => void }) {
  const isNew = renter === undefined;
  const create = useCreateRenter();
  const update = useUpdateRenter();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const createForm = useForm<RenterFormValues, unknown, z.output<typeof createRenterFormSchema>>({
    resolver: zodResolver(createRenterFormSchema),
    defaultValues: EMPTY_RENTER_FORM,
  });
  const updateForm = useForm<RenterFormValues, unknown, z.output<typeof updateRenterFormSchema>>({
    resolver: zodResolver(updateRenterFormSchema),
    defaultValues: isNew ? EMPTY_RENTER_FORM : renterFormValuesOf(renter),
  });

  const submitCreate = createForm.handleSubmit((input) => {
    setFormError(null);
    create.mutate(input, {
      onSuccess: (saved) => {
        toast({ title: 'Cliente creado', description: saved.fullName });
        onClose();
      },
      onError: (error) => setFormError(applyApiError(error, createForm.setError)),
    });
  });

  const submitUpdate = updateForm.handleSubmit((input) => {
    if (renter === undefined) return;
    setFormError(null);
    update.mutate(
      { id: renter.id, input },
      {
        onSuccess: (saved) => {
          toast({ title: 'Cliente guardado', description: saved.fullName });
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
            <DialogTitle>{isNew ? 'Nuevo cliente de renta' : 'Editar cliente'}</DialogTitle>
            <DialogDescription>
              {isNew
                ? 'Solo el nombre es obligatorio; el contrato pide el resto.'
                : renter.fullName}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-6">
            {isNew ? (
              <RenterFields form={createForm} withActivity={false} />
            ) : (
              <RenterFields form={updateForm} withActivity />
            )}
            <FormAlert message={formError} />
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={create.isPending || update.isPending}>
              {isNew ? 'Crear cliente' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RenterFields<Output>({
  form,
  withActivity,
}: {
  form: UseFormReturn<RenterFormValues, unknown, Output>;
  /** Desactivar solo tiene sentido en la edición. */
  withActivity: boolean;
}) {
  const errors = form.formState.errors;
  const blocked = form.watch('isBlocked');
  const field = (name: FormFieldName) => ({ error: errors[name]?.message, ...form.register(name) });
  const wide = 'sm:col-span-2 [[data-density=bahia]_&]:col-span-1';

  const dateField = (name: FormFieldName, label: string) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field: control }) => (
        <TextField
          id={`renter-${name}`}
          label={label}
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          mono
          error={errors[name]?.message}
          name={control.name}
          value={String(control.value)}
          onBlur={control.onBlur}
          onChange={(event) => control.onChange(maskDate(event.target.value))}
        />
      )}
    />
  );

  const toggle = (name: 'isBlocked' | 'isActive', label: string, hint: string) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field: control }) => (
        <div className={`flex min-h-(--touch-min) items-center justify-between gap-3 ${wide}`}>
          <label htmlFor={`renter-${name}`} className="text-body font-semibold">
            {label}
            <span className="text-text-faint block text-dense font-normal">{hint}</span>
          </label>
          <Switch
            id={`renter-${name}`}
            checked={control.value}
            onCheckedChange={control.onChange}
          />
        </div>
      )}
    />
  );

  return (
    <>
      <FormSection title="Datos personales">
        <TextField
          id="renter-name"
          label="Nombre completo"
          placeholder="Nombre y apellidos"
          className={wide}
          {...field('fullName')}
        />
        <TextField id="renter-document" label="DUI o pasaporte" mono {...field('documentId')} />
        {dateField('birthDate', 'Fecha de nacimiento')}
        <TextField id="renter-country" label="País" {...field('country')} />
        <TextField id="renter-occupation" label="Ocupación" {...field('occupation')} />
      </FormSection>

      <FormSection title="Licencia">
        <TextField
          id="renter-license"
          label="Número de licencia"
          mono
          {...field('licenseNumber')}
        />
        {dateField('licenseExpiresAt', 'Vence la licencia')}
      </FormSection>

      <FormSection title="Contacto">
        <TextField
          id="renter-mobile"
          label="Celular"
          inputMode="tel"
          mono
          {...field('mobilePhone')}
        />
        <TextField id="renter-phone" label="Teléfono" inputMode="tel" mono {...field('phone')} />
        <TextField
          id="renter-email"
          label="Correo"
          inputMode="email"
          className={wide}
          {...field('email')}
        />
        <TextField id="renter-address" label="Dirección" className={wide} {...field('address')} />
        <TextField id="renter-workplace" label="Lugar de trabajo" {...field('workplace')} />
        <TextField id="renter-representative" label="Representante" {...field('representative')} />
        <TextField
          id="renter-permanent-address"
          label="Dirección permanente"
          {...field('permanentAddress')}
        />
        <TextField
          id="renter-permanent-phone"
          label="Teléfono permanente"
          inputMode="tel"
          mono
          {...field('permanentPhone')}
        />
      </FormSection>

      <FormSection title="Estado y notas">
        {toggle('isBlocked', 'No rentar', 'Una renta nueva para este cliente se rechaza.')}
        {blocked ? (
          <TextField
            id="renter-block-reason"
            label="Motivo"
            className={wide}
            {...field('blockReason')}
          />
        ) : null}
        {withActivity
          ? toggle(
              'isActive',
              'Activo',
              'Inactivo no sale al buscar para una renta; su historial queda.',
            )
          : null}
        <TextAreaField
          id="renter-notes"
          label="Notas"
          className={wide}
          error={errors.notes?.message}
          {...form.register('notes')}
        />
      </FormSection>
    </>
  );
}
