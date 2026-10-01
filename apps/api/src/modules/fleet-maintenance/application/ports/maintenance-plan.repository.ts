import type { MaintenancePlanTask } from '@elite/shared';

/** Una tarea nueva, con la clave ya armada y el orden ya elegido. */
export interface NewPlanTask {
  key: string;
  name: string;
  intervalKm: number | null;
  intervalDays: number | null;
  sortOrder: number;
}

export type PlanTaskChanges = Partial<
  Pick<MaintenancePlanTask, 'name' | 'intervalKm' | 'intervalDays' | 'sortOrder' | 'isActive'>
>;

/** Puerto del plan de mantenimiento (099). */
export interface MaintenancePlanRepository {
  /** Todas, activas e inactivas. Orden: `sortOrder`, después nombre. */
  list(): Promise<MaintenancePlanTask[]>;
  findById(id: string): Promise<MaintenancePlanTask | null>;
  /** @throws MaintenanceTaskTakenError si la clave única choca. */
  create(task: NewPlanTask): Promise<MaintenancePlanTask>;
  update(id: string, changes: PlanTaskChanges): Promise<MaintenancePlanTask>;
}

export const MAINTENANCE_PLAN_REPOSITORY = Symbol('fleet-maintenance.MaintenancePlanRepository');
