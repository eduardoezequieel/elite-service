'use client';

import type { MaintenancePlanTask } from '@elite/shared';
import { Plus } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';

import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { FieldError, FormAlert } from '@/features/inventory/components/form-fields';
import { AffixInput } from '@/features/rental-settings/components/settings-row';
import { useCreatePlanTask, usePlanTasks, useUpdatePlanTask } from '../hooks/use-fleet-maintenance';
import { intervalLabel } from '../maintenance-view';
import {
  activeTasks,
  apiDraftErrors,
  draftOf,
  draftUnchanged,
  EMPTY_DRAFT,
  parseNewTask,
  parseTaskEdit,
  type DraftErrors,
  type TaskDraft,
} from '../plan-task-draft';

/** Una fila se apila en tablet y en bahía. */
const STACK =
  'xl:flex-row xl:items-center [[data-density=bahia]_&]:flex-col [[data-density=bahia]_&]:items-stretch';

/**
 * Las tareas del plan de servicio, una sola lista para toda la flota (123).
 * Tocar una fila la edita en el lugar; «Quitar» la desactiva con Deshacer.
 * Cada acción se guarda al momento, no con la barra de Ajustes.
 */
export function PlanTaskList() {
  const plan = usePlanTasks();
  const create = useCreatePlanTask();
  const update = useUpdatePlanTask();
  const { toast } = useToast();

  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<TaskDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [failure, setFailure] = useState<string | null>(null);

  if (plan.isPending) return <Skeleton className="h-40 rounded-card" />;

  if (plan.error !== null) {
    return (
      <p className="text-danger-text text-body" role="alert">
        {plan.error.message}
      </p>
    );
  }

  const tasks = activeTasks(plan.data);

  function start(task: MaintenancePlanTask | 'new'): void {
    setEditing(task === 'new' ? 'new' : task.id);
    setDraft(task === 'new' ? EMPTY_DRAFT : draftOf(task));
    setErrors({});
    setFailure(null);
  }

  function stop(): void {
    setEditing(null);
    setErrors({});
    setFailure(null);
  }

  function onFailure(error: { message: string; details?: unknown }): void {
    setErrors(apiDraftErrors(error.details));
    setFailure(error.message);
  }

  function save(): void {
    if (editing === 'new') {
      const parsed = parseNewTask(draft);
      if (!parsed.ok) {
        setErrors(parsed.errors);
        return;
      }
      create.mutate(parsed.input, {
        onSuccess: (saved) => {
          toast({ title: 'Tarea agregada', description: saved.name });
          stop();
        },
        onError: onFailure,
      });
      return;
    }

    const task = tasks.find((item) => item.id === editing);
    if (task === undefined || draftUnchanged(draft, task)) {
      stop();
      return;
    }

    const parsed = parseTaskEdit(draft);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    update.mutate(
      { id: task.id, input: parsed.input },
      {
        onSuccess: (saved) => {
          toast({ title: 'Tarea guardada', description: saved.name });
          stop();
        },
        onError: onFailure,
      },
    );
  }

  function remove(task: MaintenancePlanTask): void {
    setFailure(null);
    update.mutate(
      { id: task.id, input: { isActive: false } },
      {
        onSuccess: (saved) =>
          toast({
            title: `Quitada: ${saved.name}`,
            action: {
              label: 'Deshacer',
              onClick: () =>
                update.mutate(
                  { id: saved.id, input: { isActive: true } },
                  { onError: (error) => setFailure(error.message) },
                ),
            },
          }),
        onError: (error) => setFailure(error.message),
      },
    );
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      save();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      stop();
    }
  }

  const saving = create.isPending || update.isPending;

  const editor = (
    <div className="flex flex-col gap-3 px-4.5 py-3.5">
      <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-[minmax(0,1fr)_11rem_11rem] [[data-density=bahia]_&]:grid-cols-1">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Input
            aria-label="Nombre de la tarea"
            placeholder="Nombre"
            maxLength={80}
            autoComplete="off"
            autoFocus
            value={draft.name}
            aria-invalid={errors.name ? true : undefined}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            onKeyDown={onKey}
          />
          <FieldError message={errors.name} />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <AffixInput
            aria-label="Cada cuántos km"
            before="cada"
            after="km"
            mono
            inputMode="numeric"
            value={draft.intervalKm}
            error={errors.intervalKm}
            onChange={(event) => setDraft({ ...draft, intervalKm: event.target.value })}
            onKeyDown={onKey}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <AffixInput
            aria-label="Cada cuántos días"
            before="cada"
            after="días"
            mono
            inputMode="numeric"
            value={draft.intervalDays}
            error={errors.intervalDays}
            onChange={(event) => setDraft({ ...draft, intervalDays: event.target.value })}
            onKeyDown={onKey}
          />
        </div>
      </div>
      <FormAlert message={failure} />
      <div className="flex flex-wrap justify-end gap-2.5 [[data-density=bahia]_&]:[&>*]:flex-1">
        <Button type="button" variant="ghost" onClick={stop}>
          Cancelar
        </Button>
        <Button type="button" variant="outline" loading={saving} onClick={save}>
          {editing === 'new' ? 'Agregar' : 'Guardar'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-2.5">
      {editing === null ? <FormAlert message={failure} /> : null}
      <ul className="border-line-soft bg-surface divide-line-soft divide-y rounded-card border">
        {tasks.map((task) =>
          editing === task.id ? (
            <li key={task.id}>{editor}</li>
          ) : (
            <li key={task.id} className={`flex flex-col gap-1 px-2 py-1.5 ${STACK}`}>
              <button
                type="button"
                onClick={() => start(task)}
                className="hover:bg-surface-2 flex min-h-(--touch-min) min-w-0 flex-1 flex-col items-start justify-center gap-0.5 rounded-control px-2.5 py-1.5 text-left transition-colors duration-(--duration-state) ease-standard"
              >
                <span className="text-body font-semibold">{task.name}</span>
                <span className="text-text-dim text-dense font-mono tabular-nums">
                  {intervalLabel(task)}
                </span>
              </button>
              <Button
                type="button"
                variant="ghost"
                disabled={saving}
                onClick={() => remove(task)}
                className="self-end xl:self-center [[data-density=bahia]_&]:self-end"
              >
                Quitar
                <span className="sr-only"> {task.name}</span>
              </Button>
            </li>
          ),
        )}
        {editing === 'new' ? <li>{editor}</li> : null}
        {editing === 'new' ? null : (
          <li className="px-2 py-1.5">
            <Button type="button" variant="ghost" onClick={() => start('new')}>
              <Plus className="size-icon" strokeWidth={1.5} aria-hidden />
              Agregar tarea
            </Button>
          </li>
        )}
      </ul>
    </div>
  );
}
