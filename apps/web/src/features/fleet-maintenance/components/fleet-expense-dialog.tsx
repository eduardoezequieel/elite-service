'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { FLEET_EXPENSE_TYPES, FLEET_EXPENSE_TYPE_LABELS } from '@elite/shared';
import type { FleetExpenseRow, FleetExpenseType } from '@elite/shared';
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
import {
  FieldError,
  FormAlert,
  TextAreaField,
  TextField,
} from '@/features/inventory/components/form-fields';
import type { ApiError } from '@/lib/api';
import { maskDate } from '@/lib/civil-date';
import { formatMoney } from '@/lib/money';
import {
  createFleetExpenseFormSchema,
  emptyFleetExpenseForm,
  fleetExpenseFormValuesOf,
  updateFleetExpenseFormSchema,
  type FleetExpenseFormValues,
} from '../forms';
import { useCreateFleetExpense, useUpdateFleetExpense } from '../hooks/use-fleet-maintenance';
import { VehicleSelect } from './vehicle-select';

const TYPE_OPTIONS = FLEET_EXPENSE_TYPES.map((type) => ({
  value: type,
  label: FLEET_EXPENSE_TYPE_LABELS[type],
}));

type FieldName = Path<FleetExpenseFormValues>;

const FIELDS: readonly string[] = [
  'vehicleId',
  'type',
  'amount',
  'incurredAt',
  'odometerKm',
  'description',
];

function applyApiError(
  error: ApiError,
  setError: (name: FieldName, error: { message: string }) => void,
): string {
  if (typeof error.details === 'object' && error.details !== null) {
    for (const [field, message] of Object.entries(error.details as Record<string, unknown>)) {
      if (FIELDS.includes(field) && typeof message === 'string') {
        setError(field as FieldName, { message });
      }
    }
  }

  return error.message;
}

/**
 * Alta y edición de un gasto manual de un carro (099 RN-3). Los lavados del
 * carwash y las multas no cargadas llegan solos y no pasan por acá.
 */
export function FleetExpenseDialog({
  expense,
  vehicleId,
  onClose,
}: {
  /** El gasto que se edita; ausente en el alta. */
  expense?: FleetExpenseRow;
  /** El carro ya elegido en el alta (desde su ficha). */
  vehicleId?: string;
  onClose: () => void;
}) {
  const isNew = expense === undefined;
  const create = useCreateFleetExpense();
  const update = useUpdateFleetExpense();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const defaults = isNew ? emptyFleetExpenseForm(vehicleId) : fleetExpenseFormValuesOf(expense);

  const createForm = useForm<
    FleetExpenseFormValues,
    unknown,
    z.output<typeof createFleetExpenseFormSchema>
  >({ resolver: zodResolver(createFleetExpenseFormSchema), defaultValues: defaults });
  const updateForm = useForm<
    FleetExpenseFormValues,
    unknown,
    z.output<typeof updateFleetExpenseFormSchema>
  >({ resolver: zodResolver(updateFleetExpenseFormSchema), defaultValues: defaults });

  const saved = (row: FleetExpenseRow) => {
    toast({
      title: isNew ? 'Gasto anotado' : 'Gasto guardado',
      description: `${FLEET_EXPENSE_TYPE_LABELS[row.type]} · ${formatMoney(row.amount)}`,
    });
    onClose();
  };

  const submitCreate = createForm.handleSubmit((input) => {
    setFormError(null);
    create.mutate(input, {
      onSuccess: saved,
      onError: (error) => setFormError(applyApiError(error, createForm.setError)),
    });
  });

  const submitUpdate = updateForm.handleSubmit((input) => {
    if (expense === undefined) return;
    setFormError(null);
    update.mutate(
      { id: expense.id, input },
      {
        onSuccess: saved,
        onError: (error) => setFormError(applyApiError(error, updateForm.setError)),
      },
    );
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="md:max-w-xl">
        <form
          noValidate
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={isNew ? submitCreate : submitUpdate}
        >
          <DialogHeader>
            <DialogTitle>{isNew ? 'Nuevo gasto' : 'Editar gasto'}</DialogTitle>
            <DialogDescription>
              Los lavados del carwash y las multas que no se le cargaron al cliente se suman solos.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            {isNew ? <ExpenseFields form={createForm} /> : <ExpenseFields form={updateForm} />}
            <FormAlert message={formError} />
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={create.isPending || update.isPending}>
              {isNew ? 'Anotar gasto' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ExpenseFields<Output>({
  form,
}: {
  form: UseFormReturn<FleetExpenseFormValues, unknown, Output>;
}) {
  const errors = form.formState.errors;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
      <div className="flex flex-col gap-1.5 sm:col-span-2 [[data-density=bahia]_&]:col-span-1">
        <Controller
          control={form.control}
          name="vehicleId"
          render={({ field }) => (
            <VehicleSelect
              id="expense-vehicle"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              invalid={errors.vehicleId !== undefined}
            />
          )}
        />
        <FieldError message={errors.vehicleId?.message} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Controller
          control={form.control}
          name="type"
          render={({ field }) => (
            <Combobox
              id="expense-type"
              label="Tipo"
              options={TYPE_OPTIONS}
              value={field.value}
              onChange={(value) => field.onChange(value as FleetExpenseType)}
              onBlur={field.onBlur}
              invalid={errors.type !== undefined}
            />
          )}
        />
        <FieldError message={errors.type?.message} />
      </div>
      <TextField
        id="expense-amount"
        label="Monto ($)"
        inputMode="decimal"
        placeholder="0.00"
        mono
        error={errors.amount?.message}
        {...form.register('amount')}
      />
      <Controller
        control={form.control}
        name="incurredAt"
        render={({ field }) => (
          <TextField
            id="expense-date"
            label="Fecha"
            inputMode="numeric"
            placeholder="dd/mm/aaaa"
            mono
            error={errors.incurredAt?.message}
            name={field.name}
            value={field.value}
            onBlur={field.onBlur}
            onChange={(event) => field.onChange(maskDate(event.target.value))}
          />
        )}
      />
      <TextField
        id="expense-km"
        label="Km del carro (opcional)"
        inputMode="numeric"
        mono
        error={errors.odometerKm?.message}
        {...form.register('odometerKm')}
      />
      <TextAreaField
        id="expense-description"
        label="Descripción"
        className="sm:col-span-2 [[data-density=bahia]_&]:col-span-1"
        error={errors.description?.message}
        {...form.register('description')}
      />
    </div>
  );
}
