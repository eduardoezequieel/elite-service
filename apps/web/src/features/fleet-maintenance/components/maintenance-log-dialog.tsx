'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, type Path } from 'react-hook-form';
import type { z } from 'zod';

import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { FormSection } from '@/features/rentals/components/form-section';
import type { ApiError } from '@/lib/api';
import { maskDate } from '@/lib/civil-date';
import {
  emptyMaintenanceLogForm,
  maintenanceLogFormSchema,
  selectableTasks,
  type MaintenanceLogFormValues,
} from '../forms';
import { usePlanTasks, useRecordMaintenanceService } from '../hooks/use-fleet-maintenance';
import { intervalLabel } from '../maintenance-view';
import { VehicleSelect } from './vehicle-select';

type FieldName = Path<MaintenanceLogFormValues>;

const FIELDS: readonly FieldName[] = [
  'vehicleId',
  'taskIds',
  'performedAt',
  'odometerKm',
  'cost',
  'shop',
  'notes',
];

function applyApiError(
  error: ApiError,
  setError: (name: FieldName, error: { message: string }) => void,
): string {
  if (typeof error.details === 'object' && error.details !== null) {
    for (const [field, message] of Object.entries(error.details as Record<string, unknown>)) {
      if ((FIELDS as readonly string[]).includes(field) && typeof message === 'string') {
        setError(field as FieldName, { message });
      }
    }
  }

  return error.message;
}

/**
 * Registrar servicio (099): carro, una o varias tareas, fecha, km, costo,
 * taller y notas. Con costo, cada tarea deja su gasto de mantenimiento; con
 * km mayor al del carro, el carro se actualiza.
 */
export function MaintenanceLogDialog({
  vehicleId,
  taskIds,
  onClose,
}: {
  /** El carro ya elegido (desde su ficha o su fila). */
  vehicleId?: string;
  /** Las tareas marcadas de entrada (las pendientes de esa fila). */
  taskIds?: string[];
  onClose: () => void;
}) {
  const plan = usePlanTasks();
  const record = useRecordMaintenanceService();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const tasks = selectableTasks(plan.data ?? []);

  const form = useForm<
    MaintenanceLogFormValues,
    unknown,
    z.output<typeof maintenanceLogFormSchema>
  >({
    resolver: zodResolver(maintenanceLogFormSchema),
    defaultValues: emptyMaintenanceLogForm(vehicleId, taskIds),
  });
  const errors = form.formState.errors;

  const submit = form.handleSubmit((input) => {
    setFormError(null);
    record.mutate(input, {
      onSuccess: (logs) => {
        toast({
          title: 'Servicio registrado',
          description: logs.length === 1 ? (logs[0]?.taskName ?? '') : `${logs.length} tareas`,
        });
        onClose();
      },
      onError: (error) => setFormError(applyApiError(error, form.setError)),
    });
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="md:max-w-2xl">
        <form noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Registrar servicio</DialogTitle>
            <DialogDescription>
              Cada tarea marcada reinicia su cuenta desde esta fecha y estos km.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-6">
            <FormSection title="Carro y fecha">
              <div className="flex flex-col gap-1.5 sm:col-span-2 [[data-density=bahia]_&]:col-span-1">
                <Controller
                  control={form.control}
                  name="vehicleId"
                  render={({ field }) => (
                    <VehicleSelect
                      id="maintenance-vehicle"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      invalid={errors.vehicleId !== undefined}
                    />
                  )}
                />
                <FieldError message={errors.vehicleId?.message} />
              </div>
              <Controller
                control={form.control}
                name="performedAt"
                render={({ field }) => (
                  <TextField
                    id="maintenance-date"
                    label="Fecha"
                    inputMode="numeric"
                    placeholder="dd/mm/aaaa"
                    mono
                    error={errors.performedAt?.message}
                    name={field.name}
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={(event) => field.onChange(maskDate(event.target.value))}
                  />
                )}
              />
              <TextField
                id="maintenance-km"
                label="Km del carro (opcional)"
                inputMode="numeric"
                mono
                error={errors.odometerKm?.message}
                {...form.register('odometerKm')}
              />
            </FormSection>

            <section className="flex flex-col gap-3">
              <div className="border-line-soft border-b pb-2">
                <h3 className="text-title text-text">Tareas</h3>
                <p className="text-text-faint text-dense">
                  Marcá todo lo que se hizo en esta visita.
                </p>
              </div>
              {plan.isPending ? (
                <p className="text-text-dim text-body">Cargando el plan…</p>
              ) : plan.error ? (
                <p className="text-danger-text text-body" role="alert">
                  {plan.error.message}
                </p>
              ) : (
                <Controller
                  control={form.control}
                  name="taskIds"
                  render={({ field }) => (
                    <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
                      {tasks.map((task) => {
                        const checked = field.value.includes(task.id);
                        const id = `maintenance-task-${task.id}`;

                        return (
                          <li key={task.id}>
                            <label
                              htmlFor={id}
                              className="hover:bg-surface-2 flex min-h-(--touch-min) cursor-pointer items-center gap-3 rounded-control px-2 py-1.5"
                            >
                              <Checkbox
                                id={id}
                                checked={checked}
                                onCheckedChange={(next) =>
                                  field.onChange(
                                    next === true
                                      ? [...field.value, task.id]
                                      : field.value.filter((value) => value !== task.id),
                                  )
                                }
                              />
                              <span className="flex min-w-0 flex-col">
                                <span className="text-body">{task.name}</span>
                                <span className="text-text-faint text-dense">
                                  {intervalLabel(task)}
                                </span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                />
              )}
              <FieldError message={errors.taskIds?.message} />
            </section>

            <FormSection
              title="Costo y taller"
              hint="Con costo, queda como gasto de mantenimiento del carro. Varias tareas se reparten el costo."
            >
              <TextField
                id="maintenance-cost"
                label="Costo total ($, opcional)"
                inputMode="decimal"
                placeholder="0.00"
                mono
                error={errors.cost?.message}
                {...form.register('cost')}
              />
              <TextField
                id="maintenance-shop"
                label="Taller"
                error={errors.shop?.message}
                {...form.register('shop')}
              />
              <TextAreaField
                id="maintenance-notes"
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
            <Button type="submit" loading={record.isPending}>
              Registrar servicio
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
