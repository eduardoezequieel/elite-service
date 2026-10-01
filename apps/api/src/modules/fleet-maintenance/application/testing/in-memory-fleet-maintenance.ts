import type {
  CreateFleetExpenseInput,
  FleetExpenseRow,
  MaintenanceLog,
  MaintenanceLogsQuery,
  MaintenancePlanTask,
  UpdateFleetExpenseInput,
} from '@elite/shared';

import { MaintenanceTaskTakenError } from '../../domain/plan-task';
import type { FinishedTrip, LastService, MaintenanceVehicle } from '../../domain/vehicle-status';
import type {
  AutomaticExpenseSource,
  ExpenseFilter,
  FleetExpenseRepository,
} from '../ports/fleet-expense.repository';
import type { FleetSnapshotSource } from '../ports/fleet-snapshot.source';
import type {
  MaintenanceLogRepository,
  NewMaintenanceService,
} from '../ports/maintenance-log.repository';
import type {
  MaintenancePlanRepository,
  NewPlanTask,
  PlanTaskChanges,
} from '../ports/maintenance-plan.repository';
import type { MaintenanceSettings, MaintenanceSettingsSource } from '../ports/maintenance-settings';

let sequence = 0;

/** Un uuid válido y distinto en cada llamada. */
export function nextId(): string {
  sequence += 1;

  return `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
}

/** Las 8 tareas del seed de la 095. */
export const DEFAULT_PLAN: readonly Omit<MaintenancePlanTask, 'id'>[] = [
  { key: 'oil', name: 'Cambio de aceite y filtro', intervalKm: 5000, intervalDays: 90 },
  { key: 'general', name: 'Revisión general en taller', intervalKm: null, intervalDays: 30 },
  { key: 'tires', name: 'Rotación de llantas', intervalKm: 10000, intervalDays: null },
  { key: 'alignment', name: 'Alineación y balanceo', intervalKm: 10000, intervalDays: 180 },
  { key: 'brakes', name: 'Revisión de frenos', intervalKm: 10000, intervalDays: 180 },
  { key: 'air_filter', name: 'Filtro de aire', intervalKm: 15000, intervalDays: 365 },
  { key: 'battery', name: 'Revisión de batería', intervalKm: null, intervalDays: 180 },
  { key: 'coolant', name: 'Cambio de refrigerante', intervalKm: 40000, intervalDays: 730 },
].map((task, index) => ({ ...task, sortOrder: index + 1, isActive: true }));

export class InMemoryMaintenancePlanRepository implements MaintenancePlanRepository {
  readonly rows: MaintenancePlanTask[];

  constructor(seed: readonly Omit<MaintenancePlanTask, 'id'>[] = DEFAULT_PLAN) {
    this.rows = seed.map((task) => ({ ...task, id: nextId() }));
  }

  byKey(key: string): MaintenancePlanTask {
    const task = this.rows.find((row) => row.key === key);
    if (task === undefined) throw new Error(`Unknown task ${key}`);

    return task;
  }

  list(): Promise<MaintenancePlanTask[]> {
    const rows = [...this.rows].sort(
      (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
    );

    return Promise.resolve(rows.map((row) => ({ ...row })));
  }

  findById(id: string): Promise<MaintenancePlanTask | null> {
    const row = this.rows.find((candidate) => candidate.id === id);

    return Promise.resolve(row === undefined ? null : { ...row });
  }

  create(task: NewPlanTask): Promise<MaintenancePlanTask> {
    if (this.rows.some((row) => row.key === task.key)) {
      throw new MaintenanceTaskTakenError(task.name);
    }

    const row: MaintenancePlanTask = { ...task, id: nextId(), isActive: true };
    this.rows.push(row);

    return Promise.resolve({ ...row });
  }

  update(id: string, changes: PlanTaskChanges): Promise<MaintenancePlanTask> {
    const row = this.rows.find((candidate) => candidate.id === id);
    if (row === undefined) throw new Error(`Unknown task ${id}`);

    for (const [key, value] of Object.entries(changes)) {
      if (value !== undefined) Object.assign(row, { [key]: value });
    }

    return Promise.resolve({ ...row });
  }
}

export class InMemoryFleetSnapshotSource implements FleetSnapshotSource {
  readonly vehicles: MaintenanceVehicle[] = [];
  readonly trips: FinishedTrip[] = [];

  add(vehicle: Partial<MaintenanceVehicle> = {}): MaintenanceVehicle {
    const row: MaintenanceVehicle = {
      id: nextId(),
      plate: 'P53DBC',
      make: 'Toyota',
      model: 'Yaris',
      year: 2022,
      odometerKm: 0,
      status: 'ACTIVE',
      insuranceExpiresAt: null,
      registrationExpiresAt: null,
      ...vehicle,
    };
    this.vehicles.push(row);

    return row;
  }

  findVehicle(id: string): Promise<MaintenanceVehicle | null> {
    const row = this.vehicles.find((vehicle) => vehicle.id === id);

    return Promise.resolve(row === undefined ? null : { ...row });
  }

  activeVehicles(): Promise<MaintenanceVehicle[]> {
    return Promise.resolve(
      this.vehicles.filter((vehicle) => vehicle.status !== 'RETIRED').map((row) => ({ ...row })),
    );
  }

  finishedTrips(vehicleIds: readonly string[], since: Date): Promise<FinishedTrip[]> {
    return Promise.resolve(
      this.trips.filter(
        (trip) => vehicleIds.includes(trip.vehicleId) && trip.returnAt.getTime() >= since.getTime(),
      ),
    );
  }
}

export class InMemoryMaintenanceSettings implements MaintenanceSettingsSource {
  value: MaintenanceSettings = { kmAlert: 500, daysAlert: 7, companyName: 'Riveras Rent a Car' };

  current(): Promise<MaintenanceSettings> {
    return Promise.resolve({ ...this.value });
  }
}

function vehicleRef(vehicle: MaintenanceVehicle): FleetExpenseRow['vehicle'] {
  return {
    id: vehicle.id,
    plate: vehicle.plate,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
  };
}

function inRange(row: FleetExpenseRow, filter: Omit<ExpenseFilter, 'type'>): boolean {
  return (
    (filter.vehicleId === undefined || row.vehicle.id === filter.vehicleId) &&
    (filter.from === undefined || row.incurredAt >= filter.from) &&
    (filter.to === undefined || row.incurredAt <= filter.to)
  );
}

export class InMemoryFleetExpenseRepository implements FleetExpenseRepository {
  readonly rows: FleetExpenseRow[] = [];

  constructor(private readonly fleet: InMemoryFleetSnapshotSource) {}

  list(filter: ExpenseFilter): Promise<FleetExpenseRow[]> {
    return Promise.resolve(
      this.rows
        .filter((row) => inRange(row, filter))
        .filter((row) => filter.type === undefined || row.type === filter.type)
        .map((row) => ({ ...row })),
    );
  }

  findById(id: string): Promise<FleetExpenseRow | null> {
    const row = this.rows.find((candidate) => candidate.id === id);

    return Promise.resolve(row === undefined ? null : { ...row });
  }

  create(input: CreateFleetExpenseInput & { createdByUserId: string }): Promise<FleetExpenseRow> {
    return Promise.resolve({ ...this.insert(input, null) });
  }

  /** Lo usa también el repositorio de servicios, como la transacción de Prisma. */
  insert(
    input: Omit<CreateFleetExpenseInput, 'type'> & { type: FleetExpenseRow['type'] },
    maintenanceLogId: string | null,
  ): FleetExpenseRow {
    const vehicle = this.fleet.vehicles.find((candidate) => candidate.id === input.vehicleId);
    if (vehicle === undefined) throw new Error(`Unknown vehicle ${input.vehicleId}`);

    const row: FleetExpenseRow = {
      id: nextId(),
      source: 'MANUAL',
      vehicle: vehicleRef(vehicle),
      type: input.type,
      amount: input.amount,
      incurredAt: input.incurredAt,
      odometerKm: input.odometerKm ?? null,
      description: input.description ?? null,
      maintenanceLogId,
      reference: null,
      editable: maintenanceLogId === null,
    };
    this.rows.push(row);

    return row;
  }

  update(id: string, changes: UpdateFleetExpenseInput): Promise<FleetExpenseRow> {
    const row = this.rows.find((candidate) => candidate.id === id);
    if (row === undefined) throw new Error(`Unknown expense ${id}`);

    const { vehicleId, ...rest } = changes;
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) Object.assign(row, { [key]: value });
    }
    const vehicle = this.fleet.vehicles.find((candidate) => candidate.id === vehicleId);
    if (vehicle !== undefined) row.vehicle = vehicleRef(vehicle);

    return Promise.resolve({ ...row });
  }

  delete(id: string): Promise<void> {
    const index = this.rows.findIndex((row) => row.id === id);
    if (index >= 0) this.rows.splice(index, 1);

    return Promise.resolve();
  }
}

export class InMemoryAutomaticExpenseSource implements AutomaticExpenseSource {
  readonly washes: FleetExpenseRow[] = [];
  readonly fines: FleetExpenseRow[] = [];

  carwashWashes(filter: Omit<ExpenseFilter, 'type'>): Promise<FleetExpenseRow[]> {
    return Promise.resolve(this.washes.filter((row) => inRange(row, filter)));
  }

  unchargedFines(filter: Omit<ExpenseFilter, 'type'>): Promise<FleetExpenseRow[]> {
    return Promise.resolve(this.fines.filter((row) => inRange(row, filter)));
  }
}

export class InMemoryMaintenanceLogRepository implements MaintenanceLogRepository {
  readonly rows: MaintenanceLog[] = [];

  constructor(
    private readonly fleet: InMemoryFleetSnapshotSource,
    private readonly expenses: InMemoryFleetExpenseRepository,
  ) {}

  list(query: MaintenanceLogsQuery): Promise<MaintenanceLog[]> {
    return Promise.resolve(
      this.rows
        .filter((row) => query.vehicleId === undefined || row.vehicleId === query.vehicleId)
        .filter((row) => query.taskId === undefined || row.taskId === query.taskId)
        .sort((left, right) => right.performedAt.localeCompare(left.performedAt))
        .map((row) => ({ ...row })),
    );
  }

  lastServices(vehicleIds: readonly string[]): Promise<LastService[]> {
    const latest = new Map<string, LastService>();

    for (const row of this.rows) {
      if (!vehicleIds.includes(row.vehicleId) || row.taskId === null) continue;

      const key = `${row.vehicleId}:${row.taskId}`;
      const current = latest.get(key);
      if (current === undefined || row.performedAt >= current.performedAt) {
        latest.set(key, {
          vehicleId: row.vehicleId,
          taskId: row.taskId,
          performedAt: row.performedAt,
          odometerKm: row.odometerKm,
        });
      }
    }

    return Promise.resolve([...latest.values()]);
  }

  record(service: NewMaintenanceService): Promise<MaintenanceLog[]> {
    const logs = service.tasks.map((task): MaintenanceLog => {
      const id = nextId();
      const expense =
        task.cost === null
          ? null
          : this.expenses.insert(
              {
                vehicleId: service.vehicleId,
                type: 'MAINTENANCE',
                amount: task.cost,
                incurredAt: service.performedAt,
                odometerKm: service.odometerKm,
                description: task.taskName,
              },
              id,
            );

      return {
        id,
        vehicleId: service.vehicleId,
        taskId: task.taskId,
        taskName: task.taskName,
        performedAt: service.performedAt,
        odometerKm: service.odometerKm,
        cost: task.cost,
        shop: service.shop,
        notes: service.notes,
        expenseId: expense?.id ?? null,
        createdAt: new Date(Date.UTC(2026, 9, 1, 12)).toISOString(),
      };
    });
    this.rows.push(...logs);

    const vehicle = this.fleet.vehicles.find((candidate) => candidate.id === service.vehicleId);
    if (
      vehicle !== undefined &&
      service.odometerKm !== null &&
      service.odometerKm > vehicle.odometerKm
    ) {
      vehicle.odometerKm = service.odometerKm;
    }

    return Promise.resolve(logs.map((row) => ({ ...row })));
  }
}
