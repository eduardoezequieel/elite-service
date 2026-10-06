'use client';

import { PERMISSIONS, createPlanTaskSchema, updatePlanTaskSchema } from '@elite/shared';
import type { MaintenancePlanTask, RentalSettings } from '@elite/shared';
import { Pencil, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Stamp } from '@/components/ui/stamp';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { FormAlert, TextField } from '@/features/inventory/components/form-fields';
import {
  useRentalSettings,
  useSaveRentalSettings,
} from '@/features/rental-settings/hooks/use-rental-settings';
import {
  rentalSettingsFormSchema,
  settingsFormValuesOf,
} from '@/features/rental-settings/settings-form';
import { FormSection } from '@/features/rentals/components/form-section';
import type { ApiError } from '@/lib/api';
import { wholeOrNull } from '@/features/rentals/form-draft';
import { useCreatePlanTask, usePlanTasks, useUpdatePlanTask } from '../hooks/use-fleet-maintenance';
import { intervalLabel } from '../maintenance-view';

interface TaskDraft {
  name: string;
  intervalKm: string;
  intervalDays: string;
}

const EMPTY_DRAFT: TaskDraft = { name: '', intervalKm: '', intervalDays: '' };

function draftOf(task: MaintenancePlanTask): TaskDraft {
  return {
    name: task.name,
    intervalKm: task.intervalKm === null ? '' : String(task.intervalKm),
    intervalDays: task.intervalDays === null ? '' : String(task.intervalDays),
  };
}

type DraftErrors = Partial<Record<keyof TaskDraft, string>>;

function pickErrors(details: Record<string, unknown>): DraftErrors {
  const pick = (key: string) => {
    const value = details[key];
    return typeof value === 'string' ? value : undefined;
  };

  return { name: pick('name'), intervalKm: pick('intervalKm'), intervalDays: pick('intervalDays') };
}

/** Los `details` de un 422 o un 409 del API, campo por campo. */
function apiErrors(error: ApiError | null): DraftErrors {
  if (error === null || typeof error.details !== 'object' || error.details === null) return {};

  return pickErrors(error.details as Record<string, unknown>);
}

/** El primer mensaje de cada campo que el schema rechazó. */
function issuesByField(issues: readonly { path: PropertyKey[]; message: string }[]): DraftErrors {
  const details: Record<string, string> = {};
  for (const issue of issues) details[String(issue.path[0] ?? '_')] ??= issue.message;

  return pickErrors(details);
}

/**
 * Los km y los días con los que se avisa (110). Viajan en la fila entera de
 * ajustes: hace falta `rentals.settings` para guardarlos.
 */
function AlertThresholds({ settings }: { settings: RentalSettings }) {
  const save = useSaveRentalSettings();
  const { toast } = useToast();
  const base = settingsFormValuesOf(settings);
  const [kmAlert, setKmAlert] = useState(base.kmAlert);
  const [daysAlert, setDaysAlert] = useState(base.daysAlert);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = rentalSettingsFormSchema.safeParse({ ...base, kmAlert, daysAlert });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revisá los avisos.');
      return;
    }

    setError(null);
    save.mutate(parsed.data, {
      onSuccess: () => toast({ title: 'Avisos guardados' }),
      onError: (failure) => setError(failure.message),
    });
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-3">
      <TextField
        id="plan-km-alert"
        label="Avisar a cuántos km"
        inputMode="numeric"
        mono
        value={kmAlert}
        onChange={(event) => setKmAlert(event.target.value)}
      />
      <TextField
        id="plan-days-alert"
        label="Avisar con cuántos días"
        inputMode="numeric"
        mono
        value={daysAlert}
        onChange={(event) => setDaysAlert(event.target.value)}
      />
      <FormAlert message={error} />
      <div className="flex justify-end">
        <Button type="submit" variant="outline" loading={save.isPending}>
          Guardar
        </Button>
      </div>
    </form>
  );
}

/**
 * El plan de servicio (099 y 110): cada tarea con cada cuánto toca, y a cuántos
 * km o días se avisa. Se agrega, se edita y se activa o desactiva; nunca se
 * borra, para no perder el historial. Quien solo tiene `fleet.read` lo ve sin
 * acciones.
 */
export function MaintenancePlanDialog({ onClose }: { onClose: () => void }) {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.fleet.actions.manage.key);
  const plan = usePlanTasks();
  const settings = useRentalSettings(canManage);
  const create = useCreatePlanTask();
  const update = useUpdatePlanTask();
  const { toast } = useToast();

  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<TaskDraft>(EMPTY_DRAFT);
  const [localErrors, setLocalErrors] = useState<DraftErrors>({});
  const saving = create.isPending || update.isPending;
  const saveError = editing === 'new' ? create.error : update.error;
  const remote = apiErrors(saveError);
  const errors: DraftErrors = {
    name: localErrors.name ?? remote.name,
    intervalKm: localErrors.intervalKm ?? remote.intervalKm,
    intervalDays: localErrors.intervalDays ?? remote.intervalDays,
  };

  function startEditing(task: MaintenancePlanTask | 'new') {
    create.reset();
    update.reset();
    setLocalErrors({});
    setEditing(task === 'new' ? 'new' : task.id);
    setDraft(task === 'new' ? EMPTY_DRAFT : draftOf(task));
  }

  function save(event: FormEvent) {
    event.preventDefault();

    const body = {
      name: draft.name,
      intervalKm: wholeOrNull(draft.intervalKm),
      intervalDays: wholeOrNull(draft.intervalDays),
    };
    const done = (saved: MaintenancePlanTask) => {
      toast({
        title: editing === 'new' ? 'Tarea agregada' : 'Tarea guardada',
        description: saved.name,
      });
      setEditing(null);
    };

    // El mismo schema que valida el API, antes de mandar.
    if (editing === 'new') {
      const parsed = createPlanTaskSchema.safeParse(body);
      setLocalErrors(parsed.success ? {} : issuesByField(parsed.error.issues));
      if (parsed.success) create.mutate(parsed.data, { onSuccess: done });
    } else if (editing !== null) {
      const parsed = updatePlanTaskSchema.safeParse(body);
      setLocalErrors(parsed.success ? {} : issuesByField(parsed.error.issues));
      if (parsed.success) update.mutate({ id: editing, input: parsed.data }, { onSuccess: done });
    }
  }

  function toggle(task: MaintenancePlanTask) {
    update.mutate(
      { id: task.id, input: { isActive: !task.isActive } },
      {
        onSuccess: (saved) =>
          toast({
            title: saved.isActive ? 'Tarea activada' : 'Tarea desactivada',
            description: saved.name,
          }),
      },
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="md:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Plan de servicio</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {canManage && settings.data !== undefined ? (
            <AlertThresholds key={settings.data.updatedAt} settings={settings.data} />
          ) : null}
          {canManage && editing !== null ? (
            <form noValidate onSubmit={save} className="flex flex-col gap-3">
              <FormSection title={editing === 'new' ? 'Nueva tarea' : 'Editar tarea'}>
                <TextField
                  id="plan-name"
                  label="Nombre"
                  className="sm:col-span-2 [[data-density=bahia]_&]:col-span-1"
                  value={draft.name}
                  error={errors.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
                <TextField
                  id="plan-km"
                  label="Cada cuántos km (vacío = no mide km)"
                  inputMode="numeric"
                  mono
                  value={draft.intervalKm}
                  error={errors.intervalKm}
                  onChange={(event) => setDraft({ ...draft, intervalKm: event.target.value })}
                />
                <TextField
                  id="plan-days"
                  label="Cada cuántos días (vacío = no mide días)"
                  inputMode="numeric"
                  mono
                  value={draft.intervalDays}
                  error={errors.intervalDays}
                  onChange={(event) => setDraft({ ...draft, intervalDays: event.target.value })}
                />
              </FormSection>
              <FormAlert message={saveError?.message ?? null} />
              <div className="flex flex-wrap justify-end gap-2.5">
                <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="outline" loading={saving}>
                  {editing === 'new' ? 'Agregar tarea' : 'Guardar tarea'}
                </Button>
              </div>
            </form>
          ) : null}

          {editing === null && update.error ? <FormAlert message={update.error.message} /> : null}

          <DataTable<MaintenancePlanTask>
            rows={plan.data ?? []}
            rowKey={(task) => task.id}
            isLoading={plan.isPending}
            errorMessage={plan.error?.message ?? null}
            emptyTitle="Nada todavía"
            emptyMessage=""
            columns={[
              {
                key: 'name',
                header: 'Tarea',
                stack: 'title',
                headerClassName: 'w-full',
                className: 'whitespace-normal',
                cell: (task) => <span className="text-body font-semibold">{task.name}</span>,
              },
              {
                key: 'interval',
                header: 'Cada',
                className: 'whitespace-nowrap',
                cell: (task) => (
                  <span className="text-text-dim font-mono tabular-nums">
                    {intervalLabel(task)}
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Estado',
                stack: 'aside',
                className: 'whitespace-nowrap',
                cell: (task) =>
                  task.isActive ? (
                    <Stamp tone="green" label="Activa" />
                  ) : (
                    <Stamp tone="neutral" label="Desactivada" />
                  ),
              },
              ...(canManage
                ? [
                    {
                      key: 'actions',
                      header: 'Acciones',
                      stack: 'actions' as const,
                      className: 'whitespace-nowrap',
                      cell: (task: MaintenancePlanTask) => (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => startEditing(task)}
                          >
                            <Pencil
                              className="text-text-faint size-3.5"
                              strokeWidth={1.5}
                              aria-hidden
                            />
                            Editar
                            <span className="sr-only"> {task.name}</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={update.isPending}
                            onClick={() => toggle(task)}
                          >
                            {task.isActive ? 'Desactivar' : 'Activar'}
                            <span className="sr-only"> {task.name}</span>
                          </Button>
                        </div>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </DialogBody>

        <DialogFooter>
          {canManage && editing === null ? (
            <Button type="button" variant="outline" onClick={() => startEditing('new')}>
              <Plus className="size-icon" strokeWidth={1.5} aria-hidden />
              Agregar tarea
            </Button>
          ) : null}
          <Button type="button" variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
