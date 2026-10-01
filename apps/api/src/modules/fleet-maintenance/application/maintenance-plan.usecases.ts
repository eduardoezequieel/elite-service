import { API_ERROR_CODES, PLAN_TASK_NEEDS_INTERVAL } from '@elite/shared';
import type { CreatePlanTaskInput, MaintenancePlanTask, UpdatePlanTaskInput } from '@elite/shared';

import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../common/errors/application-error';
import {
  MaintenanceTaskTakenError,
  comparableTaskName,
  hasInterval,
  taskKeyFrom,
} from '../domain/plan-task';
import type { MaintenancePlanRepository } from './ports/maintenance-plan.repository';

/**
 * El plan de mantenimiento (099): las tareas y cada cuánto tocan. No se
 * borran: desactivar una la saca de los cálculos y deja su historial.
 */
export class MaintenancePlanUseCases {
  constructor(private readonly plan: MaintenancePlanRepository) {}

  list(): Promise<MaintenancePlanTask[]> {
    return this.plan.list();
  }

  async create(input: CreatePlanTaskInput): Promise<MaintenancePlanTask> {
    const tasks = await this.plan.list();

    assertNameFree(tasks, input.name);

    const keys = new Set(tasks.map((task) => task.key));
    const sortOrder = input.sortOrder ?? Math.max(0, ...tasks.map((task) => task.sortOrder)) + 1;

    try {
      return await this.plan.create({
        key: taskKeyFrom(input.name, (key) => keys.has(key)),
        name: input.name,
        intervalKm: input.intervalKm ?? null,
        intervalDays: input.intervalDays ?? null,
        sortOrder,
      });
    } catch (error) {
      if (error instanceof MaintenanceTaskTakenError) throw duplicate(input.name);

      throw error;
    }
  }

  async update(id: string, input: UpdatePlanTaskInput): Promise<MaintenancePlanTask> {
    const current = await this.plan.findById(id);

    if (current === null) throw notFound();

    if (input.name !== undefined) assertNameFree(await this.plan.list(), input.name, id);

    const next = { ...current, ...input };

    if (!hasInterval(next)) {
      throw new ValidationError({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: PLAN_TASK_NEEDS_INTERVAL,
        details: { intervalKm: PLAN_TASK_NEEDS_INTERVAL },
      });
    }

    return this.plan.update(id, input);
  }
}

function assertNameFree(tasks: readonly MaintenancePlanTask[], name: string, exceptId?: string) {
  const wanted = comparableTaskName(name);

  if (tasks.some((task) => task.id !== exceptId && comparableTaskName(task.name) === wanted)) {
    throw duplicate(name);
  }
}

function duplicate(name: string): ConflictError {
  return new ConflictError({
    code: API_ERROR_CODES.DUPLICATE_MAINTENANCE_TASK,
    message: `Ya hay una tarea «${name}» en el plan.`,
    details: { name: 'Ya hay una tarea con ese nombre.' },
  });
}

function notFound(): NotFoundError {
  return new NotFoundError({
    code: API_ERROR_CODES.NOT_FOUND,
    message: 'Esa tarea del plan no existe.',
  });
}
