'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  MAINTENANCE_NOTE_MAX_LENGTH,
  MAINTENANCE_ODOMETER_MAX,
  maintenanceNoteLimitMessage,
  maintenanceOdometerLimitMessage,
} from '@elite/shared';
import type { CreateMaintenanceLogInput } from '@elite/shared';
import { useMemo, type ChangeEvent } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { CategoryField } from '@/components/category-field';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { DatePickerField } from '@/components/ui/date-picker-field';
import {
  Dialog,
  DialogBody,
  DialogContent,
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
import { todayCivil } from '@/lib/civil-date';
import { cn } from '@/lib/utils';
import {
  useCreatePlanTask,
  usePlanTasks,
  useRecordMaintenanceService,
} from '../hooks/use-fleet-maintenance';
import { serviceEntryFormSchema, type ServiceEntryValues } from '../service-entry-form';

/**
 * Anotar lo que se hizo (110, 115): qué, km, fecha y costo, con la nota a la
 * vista. El km y la nota se validan con el contrato, en su campo. La fecha es
 * el campo de un formulario.
 */
export function ServiceEntryDialog({
  vehicleId,
  odometerKm,
  taskId,
  onClose,
}: {
  vehicleId: string;
  odometerKm: number;
  /** La tarea ya elegida: la del testigo que se tocó (122). */
  taskId?: string;
  onClose: () => void;
}) {
  const plan = usePlanTasks();
  const createTask = useCreatePlanTask();
  const record = useRecordMaintenanceService();
  const { toast } = useToast();
  const tasks = (plan.data ?? []).filter((task) => task.isActive);
  const schema = useMemo(() => serviceEntryFormSchema(vehicleId), [vehicleId]);
  const form = useForm<ServiceEntryValues, unknown, CreateMaintenanceLogInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      what: taskId ?? '',
      odometerKm: String(odometerKm),
      performedAt: todayCivil(),
      cost: '',
      notes: '',
    },
  });
  const errors = form.formState.errors;
  const kmValue = form.watch('odometerKm');
  const note = form.watch('notes');
  const kmRegister = form.register('odometerKm');
  const noteOver = note.length > MAINTENANCE_NOTE_MAX_LENGTH;
  const kmOver = /^\d+$/.test(kmValue.trim()) && Number(kmValue.trim()) > MAINTENANCE_ODOMETER_MAX;

  const save = form.handleSubmit((input) => {
    record.mutate(input, {
      onSuccess: () => {
        toast({ title: 'Servicio anotado' });
        onClose();
      },
    });
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anotar lo que se hizo</DialogTitle>
        </DialogHeader>
        <form noValidate onSubmit={save}>
          <DialogBody className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Controller
                control={form.control}
                name="what"
                render={({ field }) => (
                  <CategoryField
                    id="service-what"
                    label="Qué se hizo"
                    placeholder="Busque o cree un servicio"
                    createLabel={(name) => `Crear servicio: «${name}»`}
                    createError="No se pudo crear el servicio."
                    emptyText="Todavía no hay servicios"
                    options={tasks.map((task) => ({ value: task.id, label: task.name }))}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    onCreate={async (name) => (await createTask.mutateAsync({ name })).id}
                    invalid={errors.what !== undefined}
                    pending={plan.isPending}
                  />
                )}
              />
              <FieldError message={errors.what?.message} />
            </div>
            <TextField
              id="service-km"
              label="Km"
              inputMode="numeric"
              mono
              error={
                errors.odometerKm?.message ??
                (kmOver ? maintenanceOdometerLimitMessage() : undefined)
              }
              {...kmRegister}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                event.target.value = event.target.value.replace(/\D/g, '');
                return kmRegister.onChange(event);
              }}
            />
            <Controller
              control={form.control}
              name="performedAt"
              render={({ field }) => (
                <DatePickerField
                  id="service-date"
                  label="Fecha"
                  value={field.value}
                  error={errors.performedAt?.message}
                  onChange={(civil) => {
                    field.onChange(civil);
                    field.onBlur();
                  }}
                />
              )}
            />
            <TextField
              id="service-cost"
              label="Costo"
              inputMode="decimal"
              mono
              error={errors.cost?.message}
              {...form.register('cost')}
            />
            <div className="flex flex-col gap-1.5">
              <TextAreaField
                id="service-note"
                label="Nota"
                rows={3}
                aria-describedby="service-note-count"
                error={
                  errors.notes?.message ?? (noteOver ? maintenanceNoteLimitMessage() : undefined)
                }
                {...form.register('notes')}
              />
              <p
                id="service-note-count"
                className={cn(
                  'text-dense tabular-nums',
                  noteOver ? 'text-danger-text' : 'text-text-faint',
                )}
              >
                {note.length}/{MAINTENANCE_NOTE_MAX_LENGTH}
              </p>
            </div>
            <FormAlert message={record.error?.message ?? errors.root?.message ?? null} />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={record.isPending}>
              Anotar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
