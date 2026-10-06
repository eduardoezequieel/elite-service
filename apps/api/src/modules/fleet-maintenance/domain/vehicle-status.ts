import {
  MAINTENANCE_STATUS_ORDER,
  VEHICLE_DOCUMENT_KINDS,
  documentStatus,
  pendingServiceLine,
  taskStatus,
} from '@elite/shared';
import type {
  FleetVehicleRef,
  FleetVehicleStatus,
  MaintenanceAlerts,
  MaintenancePlanTask,
  MaintenanceTaskStatus,
  VehicleDocumentKind,
  VehicleDocumentStatus,
  VehicleMaintenanceStatus,
} from '@elite/shared';

/**
 * El estado de mantenimiento de un carro (099 RN-1, RN-2, RN-6): reglas puras.
 * La cuenta de cada tarea es `taskStatus` de `@elite/shared`; acá se junta por
 * carro, con los documentos y el promedio de km por día.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Lo que el mantenimiento necesita de un carro de la flota. */
export interface MaintenanceVehicle extends FleetVehicleRef {
  odometerKm: number;
  status: FleetVehicleStatus;
  insuranceExpiresAt: string | null;
  registrationExpiresAt: string | null;
}

/** El último servicio de una tarea en un carro. */
export interface LastService {
  vehicleId: string;
  taskId: string;
  performedAt: string;
  odometerKm: number | null;
}

/** Una renta finalizada, para el promedio de km por día. */
export interface FinishedTrip {
  vehicleId: string;
  pickupAt: Date;
  returnAt: Date;
  pickupKm: number;
  returnKm: number;
}

/** Cuántos días antes mira el promedio de km por día (RN-2). */
export const KM_PER_DAY_WINDOW_DAYS = 120;

/**
 * Km por día de un carro (RN-2): el promedio de `(km de vuelta − km de salida)
 * / días` de sus rentas finalizadas. Una renta de horas cuenta como un día; la
 * que volvió con menos km que los que salió (un error al anotar) no cuenta.
 * Sin rentas, 0. Entero: es para estimar, no para cobrar.
 */
export function kmPerDay(trips: readonly FinishedTrip[]): number {
  const rates = trips
    .filter((trip) => trip.returnKm >= trip.pickupKm)
    .map((trip) => {
      const days = Math.max(
        1,
        Math.ceil((trip.returnAt.getTime() - trip.pickupAt.getTime()) / DAY_MS),
      );

      return (trip.returnKm - trip.pickupKm) / days;
    });

  if (rates.length === 0) return 0;

  return Math.round(rates.reduce((sum, rate) => sum + rate, 0) / rates.length);
}

const DOCUMENT_FIELD: Record<VehicleDocumentKind, 'insuranceExpiresAt' | 'registrationExpiresAt'> =
  {
    INSURANCE: 'insuranceExpiresAt',
    REGISTRATION: 'registrationExpiresAt',
  };

export interface VehicleStatusInput {
  vehicle: MaintenanceVehicle;
  /** Solo las tareas activas: una desactivada no entra a la cuenta. */
  plan: readonly MaintenancePlanTask[];
  /** Los últimos servicios de este carro, uno por tarea. */
  lastServices: readonly LastService[];
  trips: readonly FinishedTrip[];
  today: string;
  alerts: MaintenanceAlerts;
  /** `?days`: los días de una renta que se está por hacer. */
  days?: number;
}

/** El estado de un carro: cada tarea activa, sus documentos y su km por día. */
export function vehicleMaintenanceStatus(input: VehicleStatusInput): VehicleMaintenanceStatus {
  const { vehicle, plan, lastServices, today, alerts, days } = input;
  const perDay = kmPerDay(input.trips);

  const tasks = plan
    .map((task): MaintenanceTaskStatus & { sortOrder: number } => {
      const last = lastServices.find((service) => service.taskId === task.id) ?? null;
      const result = taskStatus({ task, last, odometerKm: vehicle.odometerKm, today, alerts });

      return {
        task: {
          id: task.id,
          key: task.key,
          name: task.name,
          intervalKm: task.intervalKm,
          intervalDays: task.intervalDays,
        },
        ...result,
        line: pendingServiceLine(
          {
            status: result.status,
            kmLeft: result.kmLeft,
            daysLeft: result.daysLeft,
            task,
          },
          vehicle.odometerKm,
          today,
        ),
        lastAt: last?.performedAt ?? null,
        lastKm: last?.odometerKm ?? null,
        dueWithinDays:
          days === undefined
            ? null
            : result.status !== 'NO_DATA' &&
              ((result.kmLeft !== null && result.kmLeft <= perDay * days) ||
                (result.daysLeft !== null && result.daysLeft <= days)),
        sortOrder: task.sortOrder,
      };
    })
    .sort(
      (left, right) =>
        MAINTENANCE_STATUS_ORDER[left.status] - MAINTENANCE_STATUS_ORDER[right.status] ||
        (left.score ?? 1) - (right.score ?? 1) ||
        left.sortOrder - right.sortOrder,
    )
    .map(({ sortOrder: _sortOrder, ...task }) => task);

  const documents = VEHICLE_DOCUMENT_KINDS.flatMap((kind): VehicleDocumentStatus[] => {
    const expiresAt = vehicle[DOCUMENT_FIELD[kind]];
    const result = documentStatus(expiresAt, today, alerts.daysAlert);

    return expiresAt === null || result === null ? [] : [{ kind, expiresAt, ...result }];
  });

  return {
    vehicle: {
      id: vehicle.id,
      plate: vehicle.plate,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      odometerKm: vehicle.odometerKm,
      status: vehicle.status,
    },
    tasks,
    documents,
    kmPerDay: perDay,
  };
}

/** Lo más urgente de un carro, para ordenar la lista: vencido, próximo, al día, sin dato. */
export function worstStatusRank(status: VehicleMaintenanceStatus): number {
  const ranks = [
    ...status.tasks.map((task) => MAINTENANCE_STATUS_ORDER[task.status]),
    ...status.documents.map((document) => MAINTENANCE_STATUS_ORDER[document.status]),
  ];

  return ranks.length === 0 ? MAINTENANCE_STATUS_ORDER.NO_DATA : Math.min(...ranks);
}
