'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  cancelSchema,
  extendSchema,
  reassignSchema,
  rentalWhenLabel,
  swapSchema,
} from '@elite/shared';
import type { RentalAgreement } from '@elite/shared';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

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
import type { ApiError } from '@/lib/api';
import { addDaysToField, fieldToInstant, instantToField, nowField } from '../datetime';
import { moneyOrNull, textOrNull } from '../form-draft';
import {
  useCancelAgreement,
  useExtendAgreement,
  useReassignAgreement,
  useSwapAgreement,
} from '../hooks/use-agreements';
import { DateTimeField } from './rental-fields';
import { VehicleAvailabilityField } from './vehicle-availability-field';

/**
 * Los diálogos chicos del detalle de una renta (096): extender, cambiar de
 * carro, reasignar una reserva y cancelar. Una columna, objetivos táctiles,
 * y el error del API al pie (convención 16).
 */

function ActionDialog({
  title,
  description,
  submitLabel,
  destructive = false,
  pending,
  error,
  onClose,
  onSubmit,
  children,
}: {
  title: string;
  description: ReactNode;
  submitLabel: string;
  destructive?: boolean;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form
          noValidate
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={onSubmit}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {children}
            <FormAlert message={error} />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Volver
            </Button>
            <Button
              type="submit"
              variant={destructive ? 'destructiveSolid' : 'default'}
              loading={pending}
            >
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Baja `details` a los campos del diálogo y devuelve el mensaje general. */
function fieldErrors<Name extends string>(
  error: ApiError,
  fields: readonly Name[],
  setError: (name: Name, value: { message: string }) => void,
): string {
  if (typeof error.details === 'object' && error.details !== null) {
    for (const [field, message] of Object.entries(error.details as Record<string, unknown>)) {
      if ((fields as readonly string[]).includes(field) && typeof message === 'string') {
        setError(field as Name, { message });
      }
    }
  }
  return error.message;
}

type DialogProps = { agreement: RentalAgreement; onClose: () => void };

// --- Extender ---------------------------------------------------------------

interface ExtendValues {
  newReturnAt: string;
  dailyRate: string;
  note: string;
}

const extendFormSchema = z
  .custom<ExtendValues>()
  .transform((values): Record<string, unknown> => ({
    newReturnAt: fieldToInstant(values.newReturnAt) ?? '',
    dailyRate: moneyOrNull(values.dailyRate) ?? undefined,
    note: textOrNull(values.note),
  }))
  .pipe(extendSchema);

export function ExtendDialog({ agreement, onClose }: DialogProps) {
  const extend = useExtendAgreement();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const current = instantToField(agreement.plannedReturnAt);
  const form = useForm<ExtendValues, unknown, z.output<typeof extendFormSchema>>({
    resolver: zodResolver(extendFormSchema),
    defaultValues: { newReturnAt: addDaysToField(current, 1), dailyRate: '', note: '' },
  });
  const errors = form.formState.errors;

  const submit = form.handleSubmit((input) => {
    setError(null);
    extend.mutate(
      { id: agreement.id, input },
      {
        onSuccess: (saved) => {
          toast({
            title: 'Renta extendida',
            description: `Regresa ${rentalWhenLabel(saved.plannedReturnAt)}`,
          });
          onClose();
        },
        onError: (apiError) =>
          setError(
            fieldErrors(apiError, ['newReturnAt', 'dailyRate', 'note'] as const, form.setError),
          ),
      },
    );
  });

  return (
    <ActionDialog
      title="Extender la renta"
      description={`Hoy regresa ${rentalWhenLabel(agreement.plannedReturnAt)}. Los días se recalculan solos.`}
      submitLabel="Extender"
      pending={extend.isPending}
      error={error}
      onClose={onClose}
      onSubmit={submit}
    >
      <DateTimeField
        id="extend-return"
        label="Nuevo regreso"
        error={errors.newReturnAt?.message}
        {...form.register('newReturnAt')}
      />
      <TextField
        id="extend-rate"
        label="Tarifa por día ($, vacío = la misma)"
        inputMode="decimal"
        mono
        placeholder={agreement.dailyRate}
        error={errors.dailyRate?.message}
        {...form.register('dailyRate')}
      />
      <TextField id="extend-note" label="Nota (opcional)" {...form.register('note')} />
    </ActionDialog>
  );
}

// --- Cambiar de carro -------------------------------------------------------

interface SwapValues {
  at: string;
  newVehicleId: string;
  dailyRate: string;
  reason: string;
}

const swapFormSchema = z
  .custom<SwapValues>()
  .transform((values): Record<string, unknown> => ({
    at: fieldToInstant(values.at) ?? '',
    newVehicleId: values.newVehicleId,
    dailyRate: moneyOrNull(values.dailyRate) ?? undefined,
    reason: values.reason,
  }))
  .pipe(swapSchema);

export function SwapDialog({ agreement, onClose }: DialogProps) {
  const swap = useSwapAgreement();
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<SwapValues, unknown, z.output<typeof swapFormSchema>>({
    resolver: zodResolver(swapFormSchema),
    defaultValues: { at: nowField(), newVehicleId: '', dailyRate: '', reason: '' },
  });
  const errors = form.formState.errors;
  const at = fieldToInstant(form.watch('at'));
  const until =
    at !== null && agreement.plannedReturnAt > at
      ? agreement.plannedReturnAt
      : at === null
        ? null
        : fieldToInstant(addDaysToField(instantToField(at), 1));

  const submit = form.handleSubmit((input) => {
    setError(null);
    swap.mutate(
      { id: agreement.id, input },
      {
        onSuccess: ({ opened }) => {
          toast({ title: 'Carro cambiado', description: 'La renta sigue con el carro nuevo.' });
          onClose();
          router.push(`/rentals/agreements/${opened.id}`);
        },
        onError: (apiError) => {
          if (apiError.code === 'VEHICLE_UNAVAILABLE' || apiError.code === 'VEHICLE_NOT_RENTABLE') {
            form.setError('newVehicleId', { message: apiError.message });
          }
          setError(
            fieldErrors(
              apiError,
              ['at', 'newVehicleId', 'dailyRate', 'reason'] as const,
              form.setError,
            ),
          );
        },
      },
    );
  });

  return (
    <ActionDialog
      title="Cambiar de carro"
      description="Esta renta se cierra en la fecha del cambio y nace otra con el carro nuevo, con su propio contrato. El depósito pasa a la nueva."
      submitLabel="Cambiar carro"
      pending={swap.isPending}
      error={error}
      onClose={onClose}
      onSubmit={submit}
    >
      <DateTimeField
        id="swap-at"
        label="Cuándo se cambia"
        error={errors.at?.message}
        {...form.register('at')}
      />
      <Controller
        control={form.control}
        name="newVehicleId"
        render={({ field }) => (
          <VehicleAvailabilityField
            id="swap-vehicle"
            label="Carro nuevo"
            from={at}
            to={until}
            value={field.value}
            onChange={(vehicleId) => field.onChange(vehicleId)}
            excludeVehicleId={agreement.vehicleId}
            error={errors.newVehicleId?.message}
          />
        )}
      />
      <TextField
        id="swap-rate"
        label="Tarifa por día ($, vacío = la del carro nuevo)"
        inputMode="decimal"
        mono
        error={errors.dailyRate?.message}
        {...form.register('dailyRate')}
      />
      <TextAreaField
        id="swap-reason"
        label="Por qué se cambia"
        error={errors.reason?.message}
        {...form.register('reason')}
      />
    </ActionDialog>
  );
}

// --- Reasignar --------------------------------------------------------------

interface ReassignValues {
  vehicleId: string;
  dailyRate: string;
}

const reassignFormSchema = z
  .custom<ReassignValues>()
  .transform((values): Record<string, unknown> => ({
    vehicleId: values.vehicleId,
    dailyRate: moneyOrNull(values.dailyRate) ?? undefined,
  }))
  .pipe(reassignSchema);

export function ReassignDialog({ agreement, onClose }: DialogProps) {
  const reassign = useReassignAgreement();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ReassignValues, unknown, z.output<typeof reassignFormSchema>>({
    resolver: zodResolver(reassignFormSchema),
    defaultValues: { vehicleId: '', dailyRate: '' },
  });
  const errors = form.formState.errors;

  const submit = form.handleSubmit((input) => {
    setError(null);
    reassign.mutate(
      { id: agreement.id, input },
      {
        onSuccess: (saved) => {
          toast({ title: 'Reserva reasignada', description: saved.vehicle.plate ?? undefined });
          onClose();
        },
        onError: (apiError) => {
          if (apiError.code === 'VEHICLE_UNAVAILABLE' || apiError.code === 'VEHICLE_NOT_RENTABLE') {
            form.setError('vehicleId', { message: apiError.message });
          }
          setError(fieldErrors(apiError, ['vehicleId', 'dailyRate'] as const, form.setError));
        },
      },
    );
  });

  return (
    <ActionDialog
      title="Reasignar la reserva"
      description="La reserva pasa a otro carro libre en las mismas fechas."
      submitLabel="Reasignar"
      pending={reassign.isPending}
      error={error}
      onClose={onClose}
      onSubmit={submit}
    >
      <Controller
        control={form.control}
        name="vehicleId"
        render={({ field }) => (
          <VehicleAvailabilityField
            id="reassign-vehicle"
            label="Carro"
            from={agreement.plannedPickupAt}
            to={agreement.plannedReturnAt}
            value={field.value}
            onChange={(vehicleId) => field.onChange(vehicleId)}
            excludeVehicleId={agreement.vehicleId}
            error={errors.vehicleId?.message}
          />
        )}
      />
      <TextField
        id="reassign-rate"
        label="Tarifa por día ($, vacío = la misma)"
        inputMode="decimal"
        mono
        placeholder={agreement.dailyRate}
        error={errors.dailyRate?.message}
        {...form.register('dailyRate')}
      />
    </ActionDialog>
  );
}

// --- Cancelar ---------------------------------------------------------------

const cancelFormSchema = z.custom<{ reason: string }>().pipe(cancelSchema);

export function CancelDialog({ agreement, onClose }: DialogProps) {
  const cancel = useCancelAgreement();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<{ reason: string }, unknown, z.output<typeof cancelFormSchema>>({
    resolver: zodResolver(cancelFormSchema),
    defaultValues: { reason: '' },
  });

  const submit = form.handleSubmit((input) => {
    setError(null);
    cancel.mutate(
      { id: agreement.id, input },
      {
        onSuccess: () => {
          toast({ title: 'Renta cancelada', description: agreement.customer.fullName });
          onClose();
        },
        onError: (apiError) => setError(apiError.message),
      },
    );
  });

  return (
    <ActionDialog
      title="Cancelar la renta"
      description={
        agreement.status === 'IN_PROGRESS'
          ? 'Una renta en curso solo se cancela si no tiene pagos. El carro vuelve a quedar libre.'
          : 'La reserva se cancela y el carro queda libre en esas fechas.'
      }
      submitLabel="Cancelar renta"
      destructive
      pending={cancel.isPending}
      error={error}
      onClose={onClose}
      onSubmit={submit}
    >
      <TextAreaField
        id="cancel-reason"
        label="Por qué se cancela"
        error={form.formState.errors.reason?.message}
        {...form.register('reason')}
      />
    </ActionDialog>
  );
}
