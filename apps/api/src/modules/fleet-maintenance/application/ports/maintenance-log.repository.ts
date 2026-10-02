import type { MaintenanceLog, MaintenanceLogsQuery, Page } from '@elite/shared';

import type { LastService } from '../../domain/vehicle-status';

/** Un servicio a registrar: una fila de log por tarea, cada una con su parte del costo. */
export interface NewMaintenanceService {
  vehicleId: string;
  performedAt: string;
  odometerKm: number | null;
  shop: string | null;
  notes: string | null;
  createdByUserId: string;
  tasks: { taskId: string; taskName: string; cost: string | null }[];
}

/** Puerto de los servicios hechos (099). */
export interface MaintenanceLogRepository {
  /** Una página (101): lo más reciente arriba, después por `createdAt` e `id`. */
  list(query: MaintenanceLogsQuery): Promise<Page<MaintenanceLog>>;
  /** El último servicio por carro y tarea, para los carros pedidos. */
  lastServices(vehicleIds: readonly string[]): Promise<LastService[]>;
  /**
   * En una sola transacción: un log por tarea, un gasto `MAINTENANCE` ligado
   * por cada log con costo, y el odómetro del carro si el del servicio es mayor.
   */
  record(service: NewMaintenanceService): Promise<MaintenanceLog[]>;
}

export const MAINTENANCE_LOG_REPOSITORY = Symbol('fleet-maintenance.MaintenanceLogRepository');
