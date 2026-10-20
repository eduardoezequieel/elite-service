import { createPlanTaskSchema, updatePlanTaskSchema } from '@elite/shared';
import type { CreatePlanTaskInput, MaintenancePlanTask, UpdatePlanTaskInput } from '@elite/shared';

import { wholeOrNull } from '@/features/rentals/form-draft';

/**
 * El plan de servicio en Ajustes (123): una tarea se escribe en el lugar
 * (nombre, cada cuántos km, cada cuántos días) y se valida con el mismo schema
 * del API antes de mandarla. Puro: la lista la dibuja `PlanTaskList`.
 */

export interface TaskDraft {
  name: string;
  intervalKm: string;
  intervalDays: string;
}

export type DraftErrors = Partial<Record<keyof TaskDraft, string>>;

export const EMPTY_DRAFT: TaskDraft = { name: '', intervalKm: '', intervalDays: '' };

export function draftOf(task: MaintenancePlanTask): TaskDraft {
  return {
    name: task.name,
    intervalKm: task.intervalKm === null ? '' : String(task.intervalKm),
    intervalDays: task.intervalDays === null ? '' : String(task.intervalDays),
  };
}

/** Solo las activas, en el orden del plan. Las desactivadas no se muestran. */
export function activeTasks(tasks: readonly MaintenancePlanTask[]): MaintenancePlanTask[] {
  return tasks
    .filter((task) => task.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'));
}

function pickErrors(details: Record<string, unknown>): DraftErrors {
  const errors: DraftErrors = {};
  for (const key of ['name', 'intervalKm', 'intervalDays'] as const) {
    const value = details[key];
    if (typeof value === 'string') errors[key] = value;
  }

  return errors;
}

/** Los `details` de un 422 o un 409 del API, campo por campo. */
export function apiDraftErrors(details: unknown): DraftErrors {
  if (typeof details !== 'object' || details === null) return {};

  return pickErrors(details as Record<string, unknown>);
}

function issuesByField(issues: readonly { path: PropertyKey[]; message: string }[]): DraftErrors {
  const details: Record<string, string> = {};
  for (const issue of issues) details[String(issue.path[0] ?? '_')] ??= issue.message;

  return pickErrors(details);
}

function bodyOf(draft: TaskDraft) {
  return {
    name: draft.name,
    intervalKm: wholeOrNull(draft.intervalKm),
    intervalDays: wholeOrNull(draft.intervalDays),
  };
}

export type DraftResult<T> = { ok: true; input: T } | { ok: false; errors: DraftErrors };

/** Una tarea nueva, lista para `POST`, o los errores de cada campo. */
export function parseNewTask(draft: TaskDraft): DraftResult<CreatePlanTaskInput> {
  const parsed = createPlanTaskSchema.safeParse(bodyOf(draft));

  return parsed.success
    ? { ok: true, input: parsed.data }
    : { ok: false, errors: issuesByField(parsed.error.issues) };
}

/** Los cambios de una tarea, listos para `PATCH`, o los errores de cada campo. */
export function parseTaskEdit(draft: TaskDraft): DraftResult<UpdatePlanTaskInput> {
  const parsed = updatePlanTaskSchema.safeParse(bodyOf(draft));

  return parsed.success
    ? { ok: true, input: parsed.data }
    : { ok: false, errors: issuesByField(parsed.error.issues) };
}

/** Si lo escrito es igual a la tarea: no hace falta mandar nada. */
export function draftUnchanged(draft: TaskDraft, task: MaintenancePlanTask): boolean {
  const saved = draftOf(task);

  return (
    draft.name.trim() === saved.name &&
    draft.intervalKm.trim() === saved.intervalKm &&
    draft.intervalDays.trim() === saved.intervalDays
  );
}
