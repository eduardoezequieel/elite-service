import { API_ERROR_CODES, centsToMoney, moneyToCents } from '@elite/shared';
import type {
  CreateMaintenanceLogInput,
  MaintenanceLog,
  MaintenanceLogsQuery,
  Page,
} from '@elite/shared';

import { NotFoundError, ValidationError } from '../../../common/errors/application-error';
import { splitCents } from '../domain/plan-task';
import type { FleetSnapshotSource } from './ports/fleet-snapshot.source';
import type { MaintenanceLogRepository } from './ports/maintenance-log.repository';
import type { MaintenancePlanRepository } from './ports/maintenance-plan.repository';

function invalid(field: string, message: string): ValidationError {
  return new ValidationError({
    code: API_ERROR_CODES.VALIDATION_ERROR,
    message,
    details: { [field]: message },
  });
}

/**
 * Los servicios hechos a un carro (099). Uno de varias tareas deja un log por
 * tarea, y el costo se reparte entre ellas: cada log con costo crea su gasto
 * `MAINTENANCE` ligado, y la suma de los gastos es el costo del servicio.
 */
export class MaintenanceLogUseCases {
  constructor(
    private readonly logs: MaintenanceLogRepository,
    private readonly plan: MaintenancePlanRepository,
    private readonly fleet: FleetSnapshotSource,
    private readonly today: () => string,
  ) {}

  list(query: MaintenanceLogsQuery): Promise<Page<MaintenanceLog>> {
    return this.logs.list(query);
  }

  async record(input: CreateMaintenanceLogInput, userId: string): Promise<MaintenanceLog[]> {
    const vehicle = await this.fleet.findVehicle(input.vehicleId);

    if (vehicle === null) throw invalid('vehicleId', 'Ese carro no existe.');

    if (input.performedAt > this.today()) {
      throw invalid('performedAt', 'La fecha del servicio no puede ser futura.');
    }

    const plan = await this.plan.list();
    const tasks = input.taskIds.map((id) => plan.find((task) => task.id === id));

    if (tasks.some((task) => task === undefined || !task.isActive)) {
      throw invalid('taskIds', 'Una de las tareas no existe o está desactivada.');
    }

    const entries = [
      ...tasks.flatMap((task) =>
        task === undefined ? [] : [{ taskId: task.id, taskName: task.name }],
      ),
      ...(input.other === undefined ? [] : [{ taskId: null, taskName: input.other }]),
    ];
    const shares =
      input.cost === null || input.cost === undefined
        ? null
        : splitCents(moneyToCents(input.cost), entries.length);

    return this.logs.record({
      vehicleId: input.vehicleId,
      performedAt: input.performedAt,
      odometerKm: input.odometerKm ?? null,
      shop: input.shop ?? null,
      notes: input.notes ?? null,
      createdByUserId: userId,
      tasks: entries.map((task, index) => {
        // Una parte en cero es «sin costo»: no deja un gasto de $0.00.
        const share = shares?.[index] ?? 0;

        return {
          taskId: task.taskId,
          taskName: task.taskName,
          cost: share > 0 ? centsToMoney(share) : null,
        };
      }),
    });
  }

  /** Borrar el servicio borra también su gasto (110, RN-2). */
  async remove(id: string): Promise<void> {
    if (!(await this.logs.remove(id))) {
      throw new NotFoundError({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese servicio no existe.',
      });
    }
  }
}
