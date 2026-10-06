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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { FormAlert, TextAreaField, TextField } from '@/features/inventory/components/form-fields';
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
    defaultValues: isNew ? EMPTY_RENTER_FORM : openedValues(renter),
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
            <DialogTitle>{isNew ? 'Nuevo cliente' : 'Editar'}</DialogTitle>
          </DialogHeader>

          <DialogBody className="space-y-6">
            {isNew ? <RenterFields form={createForm} /> : <RenterFields form={updateForm} />}
            <FormAlert message={formError} />
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={create.isPending || update.isPending}>
              {isNew ? 'Crear' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function openedValues(renter: Renter): RenterFormValues {
  const values = renterFormValuesOf(renter);
  const noRent = !renter.isActive || renter.isBlocked;

  return { ...values, isActive: !noRent, isBlocked: noRent };
}

function RenterFields<Output>({
  form,
}: {
  form: UseFormReturn<RenterFormValues, unknown, Output>;
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

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
        <TextField id="renter-name" label="Nombre" className={wide} {...field('fullName')} />
        <TextField id="renter-document" label="DUI o pasaporte" mono {...field('documentId')} />
        <TextField
          id="renter-mobile"
          label="Celular"
          inputMode="tel"
          mono
          {...field('mobilePhone')}
        />
        <TextField id="renter-license" label="Licencia" mono {...field('licenseNumber')} />
        {dateField('licenseExpiresAt', 'Vence')}
      </div>

      <details className="border-line-soft rounded-row border">
        <summary className="min-h-(--touch-min) cursor-pointer px-4 py-3 text-body font-semibold">
          Más datos
        </summary>
        <div className="grid grid-cols-1 gap-4 px-4 pb-4 sm:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
          {dateField('birthDate', 'Nacimiento')}
          <TextField id="renter-country" label="País" {...field('country')} />
          <TextField id="renter-phone" label="Teléfono" inputMode="tel" mono {...field('phone')} />
          <TextField id="renter-email" label="Correo" inputMode="email" {...field('email')} />
          <TextField id="renter-address" label="Dirección" className={wide} {...field('address')} />
          <TextField id="renter-occupation" label="Ocupación" {...field('occupation')} />
          <TextField id="renter-workplace" label="Trabajo" {...field('workplace')} />
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
          <Controller
            control={form.control}
            name="isBlocked"
            render={({ field: control }) => (
              <div className={`flex min-h-(--touch-min) items-center justify-between gap-3 ${wide}`}>
                <label htmlFor="renter-no-rent" className="text-body font-semibold">
                  No rentar
                </label>
                <Switch
                  id="renter-no-rent"
                  checked={control.value || !form.watch('isActive')}
                  onCheckedChange={(on) => {
                    form.setValue('isBlocked', on, { shouldDirty: true });
                    form.setValue('isActive', !on, { shouldDirty: true });
                    if (!on) form.setValue('blockReason', '');
                  }}
                />
              </div>
            )}
          />
          {blocked ? (
            <TextField
              id="renter-block-reason"
              label="Motivo"
              className={wide}
              {...field('blockReason')}
            />
          ) : null}
          <TextAreaField
            id="renter-notes"
            label="Notas"
            className={wide}
            error={errors.notes?.message}
            {...form.register('notes')}
          />
        </div>
      </details>
    </>
  );
}
