import type {
  FleetExpenseSource,
  MaintenanceStatus,
  MaintenanceTaskStatus,
  VehicleMaintenanceStatus,
} from '@elite/shared';

import type { StampTone } from '@/components/ui/stamp';

/**
 * Cómo se lee en pantalla el mantenimiento de la flota (099). Puro: lo que
 * llega del API ya trae el estado; acá se cuenta y se rotula.
 */

/** El tono de cada estado; la palabra la pone `MAINTENANCE_STATUS_LABELS`. */
export const MAINTENANCE_STATUS_TONE: Record<MaintenanceStatus, StampTone> = {
  OK: 'green',
  SOON: 'amber',
  DUE: 'red',
  NO_DATA: 'neutral',
};

export const EXPENSE_SOURCE_TONE: Record<FleetExpenseSource, StampTone> = {
  MANUAL: 'neutral',
  CARWASH: 'paid',
  FINE: 'amber',
};

export interface MaintenanceSummary {
  /** Tareas vencidas, en todos los carros. */
  due: number;
  /** Tareas próximas. */
  soon: number;
  /** Carros a los que les falta cargar al menos un último servicio. */
  noData: number;
  /** Seguros y tarjetas que vencen pronto o ya vencieron. */
  documents: number;
}

export function maintenanceSummary(
  statuses: readonly VehicleMaintenanceStatus[],
): MaintenanceSummary {
  const tasks = statuses.flatMap((status) => status.tasks);

  return {
    due: tasks.filter((task) => task.status === 'DUE').length,
    soon: tasks.filter((task) => task.status === 'SOON').length,
    noData: statuses.filter((status) => status.tasks.some((task) => task.status === 'NO_DATA'))
      .length,
    documents: statuses.reduce((sum, status) => sum + status.documents.length, 0),
  };
}

/** Lo que va en la lista de pendientes: vencido o próximo. */
export function isPendingTask(task: Pick<MaintenanceTaskStatus, 'status'>): boolean {
  return task.status === 'DUE' || task.status === 'SOON';
}

/** Los carros con algo pendiente: una tarea vencida o próxima, o un documento por vencer. */
export function pendingVehicles(
  statuses: readonly VehicleMaintenanceStatus[],
): VehicleMaintenanceStatus[] {
  return statuses.filter(
    (status) => status.tasks.some(isPendingTask) || status.documents.length > 0,
  );
}

/** Los carros a los que les falta cargar el último servicio de alguna tarea. */
export function vehiclesWithoutData(
  statuses: readonly VehicleMaintenanceStatus[],
): { status: VehicleMaintenanceStatus; tasks: MaintenanceTaskStatus[] }[] {
  return statuses
    .map((status) => ({
      status,
      tasks: status.tasks.filter((task) => task.status === 'NO_DATA'),
    }))
    .filter(({ tasks }) => tasks.length > 0);
}

function count(value: number, one: string, many: string): string {
  return `${value} ${value === 1 ? one : many}`;
}

/** «Faltan 4700 km · 80 días», «Se pasó por 300 km», «Le toca hoy». */
export function leftLabel(task: Pick<MaintenanceTaskStatus, 'kmLeft' | 'daysLeft'>): string {
  const parts: string[] = [];

  if (task.kmLeft !== null) {
    parts.push(task.kmLeft < 0 ? `se pasó por ${-task.kmLeft} km` : `faltan ${task.kmLeft} km`);
  }
  if (task.daysLeft !== null) {
    parts.push(
      task.daysLeft < 0
        ? `se pasó por ${count(-task.daysLeft, 'día', 'días')}`
        : task.daysLeft === 0
          ? 'le toca hoy'
          : `faltan ${count(task.daysLeft, 'día', 'días')}`,
    );
  }

  const text = parts.join(' · ');

  return text === '' ? 'Sin último servicio' : text.charAt(0).toUpperCase() + text.slice(1);
}

/** «Cada 5000 km o 90 días». */
export function intervalLabel(task: { intervalKm: number | null; intervalDays: number | null }) {
  const parts = [
    task.intervalKm === null ? null : `${task.intervalKm} km`,
    task.intervalDays === null ? null : count(task.intervalDays, 'día', 'días'),
  ].filter((part): part is string => part !== null);

  return parts.length === 0 ? '—' : `Cada ${parts.join(' o ')}`;
}

/** «Vence en 5 días», «Vence hoy», «Venció hace 3 días». */
export function documentLabel(daysLeft: number): string {
  if (daysLeft < 0) return `Venció hace ${count(-daysLeft, 'día', 'días')}`;
  if (daysLeft === 0) return 'Vence hoy';

  return `Vence en ${count(daysLeft, 'día', 'días')}`;
}

/** El enlace de WhatsApp con el texto ya escrito; el número lo elige quien lo manda. */
export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
