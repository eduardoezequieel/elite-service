import { z } from 'zod';

import type { Page } from '../contracts';
import { civilDateSchema, moneySchema, pageQueryShape } from '../schemas';
import type { FleetVehicleStatus } from './fleet';

/**
 * spec 099 — Mantenimiento de la flota y gastos por carro.
 *
 * El plan dice cada cuánto le toca algo a un carro (km, días o los dos); cada
 * servicio registrado reinicia la cuenta de su tarea. Los gastos por carro
 * vienen de tres orígenes: los que se anotan a mano, los lavados pagados del
 * carwash con la misma placa y las multas que no se le cargaron al cliente.
 */

// ===================== Estado de una tarea =====================

export const MAINTENANCE_STATUS = ['OK', 'SOON', 'DUE', 'NO_DATA'] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUS)[number];

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  OK: 'Al día',
  SOON: 'Próximo',
  DUE: 'Vencido',
  NO_DATA: 'Sin dato',
};

/** El estado de un documento: solo se listan los que vencen pronto o ya vencieron (RN-6). */
export type DocumentStatus = Extract<MaintenanceStatus, 'SOON' | 'DUE'>;

export const VEHICLE_DOCUMENT_KINDS = ['INSURANCE', 'REGISTRATION'] as const;
export type VehicleDocumentKind = (typeof VEHICLE_DOCUMENT_KINDS)[number];

export const VEHICLE_DOCUMENT_LABELS: Record<VehicleDocumentKind, string> = {
  INSURANCE: 'Seguro',
  REGISTRATION: 'Tarjeta de circulación',
};

// ===================== Gastos =====================

export const FLEET_EXPENSE_TYPES = [
  'MAINTENANCE',
  'TIRES',
  'REPAIR',
  'FINE',
  'FUEL',
  'INSURANCE',
  'GPS',
  'WASH',
  'OTHER',
] as const;
export type FleetExpenseType = (typeof FLEET_EXPENSE_TYPES)[number];

export const FLEET_EXPENSE_TYPE_LABELS: Record<FleetExpenseType, string> = {
  MAINTENANCE: 'Mantenimiento',
  TIRES: 'Llantas',
  REPAIR: 'Reparación',
  FINE: 'Multa',
  FUEL: 'Combustible',
  INSURANCE: 'Seguro',
  GPS: 'GPS',
  WASH: 'Lavado',
  OTHER: 'Otro',
};

/** De dónde sale un gasto (RN-4): anotado, lavado del carwash o multa no cargada. */
export const FLEET_EXPENSE_SOURCES = ['MANUAL', 'CARWASH', 'FINE'] as const;
export type FleetExpenseSource = (typeof FLEET_EXPENSE_SOURCES)[number];

export const FLEET_EXPENSE_SOURCE_LABELS: Record<FleetExpenseSource, string> = {
  MANUAL: 'Manual',
  CARWASH: 'Lavado',
  FINE: 'Multa',
};

/** El taller por defecto de un servicio: el de la familia. */
export const DEFAULT_MAINTENANCE_SHOP = 'Elite Service';

// ===================== DTOs =====================

/** Una tarea del plan. Sin `intervalKm` o sin `intervalDays`: no se mide por eso. */
export interface MaintenancePlanTask {
  id: string;
  key: string;
  name: string;
  intervalKm: number | null;
  intervalDays: number | null;
  sortOrder: number;
  isActive: boolean;
}

/** Un servicio hecho a un carro, de una tarea. */
export interface MaintenanceLog {
  id: string;
  vehicleId: string;
  taskId: string | null;
  /** `null` si la tarea ya no existe. */
  taskName: string | null;
  performedAt: string;
  odometerKm: number | null;
  /** Lo que costó esta tarea; `null` sin costo. */
  cost: string | null;
  shop: string | null;
  notes: string | null;
  /** El gasto `MAINTENANCE` que se creó con el costo. */
  expenseId: string | null;
  createdAt: string;
}

/** Lo mínimo de un carro para nombrarlo en una fila. */
export interface FleetVehicleRef {
  id: string;
  plate: string | null;
  make: string;
  model: string;
  year: number | null;
}

/** Una fila de gasto, venga de donde venga (RN-4). */
export interface FleetExpenseRow {
  /** Id de la fila de origen: el gasto, el lavado o la multa. Único solo junto con `source`. */
  id: string;
  source: FleetExpenseSource;
  vehicle: FleetVehicleRef;
  type: FleetExpenseType;
  amount: string;
  incurredAt: string;
  odometerKm: number | null;
  description: string | null;
  /** El servicio del que sale el gasto; se edita desde ahí (RN-3). */
  maintenanceLogId: string | null;
  /** El folio del lavado (`CW-0014`) en una fila `CARWASH`. */
  reference: string | null;
  /** Solo un gasto manual que no viene de un servicio se edita o se borra. */
  editable: boolean;
}

/**
 * `GET /fleet/expenses`: una página de filas (101) y `totalAmount`, la suma del
 * filtro entero —todas las filas, no solo las de la página—. `total` es el de
 * `Page<T>`: cuántas filas hay.
 */
export interface FleetExpenseList extends Page<FleetExpenseRow> {
  totalAmount: string;
}

export interface MaintenanceTaskStatus {
  task: Pick<MaintenancePlanTask, 'id' | 'key' | 'name' | 'intervalKm' | 'intervalDays'>;
  status: MaintenanceStatus;
  kmLeft: number | null;
  daysLeft: number | null;
  lastAt: string | null;
  lastKm: number | null;
  /** Lo que queda, de 1 (recién hecho) a 0 o menos (vencido). `null` sin dato. Para ordenar. */
  score: number | null;
  /**
   * Con `?days`: si le tocaría durante una renta de esos días (RN-2). `null`
   * si no se pidió.
   */
  dueWithinDays: boolean | null;
}

export interface VehicleDocumentStatus {
  kind: VehicleDocumentKind;
  expiresAt: string;
  daysLeft: number;
  status: DocumentStatus;
}

export interface VehicleMaintenanceStatus {
  vehicle: FleetVehicleRef & { odometerKm: number; status: FleetVehicleStatus };
  tasks: MaintenanceTaskStatus[];
  documents: VehicleDocumentStatus[];
  /** Promedio de las rentas finalizadas de los últimos 120 días; 0 sin datos (RN-2). */
  kmPerDay: number;
}

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

/**
 * `GET /fleet/maintenance/status` (101): una página de carros de la vista
 * pedida y `summary`, las cifras de todos los carros del pedido —la flota
 * entera sin `vehicleId`—, no solo los de la página.
 */
export interface MaintenanceStatusList extends Page<VehicleMaintenanceStatus> {
  summary: MaintenanceSummary;
}

// ===================== Schemas =====================

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: `No puede pasar de ${max} caracteres.` })
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

const interval = (max: number) =>
  z
    .number({ message: 'Escribí un número.' })
    .int({ message: 'Tiene que ser un número entero.' })
    .min(1, { message: 'Tiene que ser mayor que cero.' })
    .max(max, { message: `No puede pasar de ${max}.` })
    .nullable();

const odometer = z
  .number({ message: 'Escribí el kilometraje.' })
  .int({ message: 'Tiene que ser un número entero.' })
  .min(0, { message: 'No puede ser negativo.' })
  .max(2_000_000, { message: 'No puede pasar de 2000000.' });

const taskName = z
  .string()
  .trim()
  .min(1, { message: 'Escribí el nombre de la tarea.' })
  .max(80, { message: 'No puede pasar de 80 caracteres.' });

const NEEDS_INTERVAL = 'La tarea necesita km, días o los dos.';

/** Un monto mayor que cero. */
const positiveMoney = moneySchema.refine((value) => !/^0+\.00$/.test(value), {
  message: 'El monto tiene que ser mayor que cero.',
});

/** `POST /fleet/maintenance/plan`. La clave la arma el API con el nombre. */
export const createPlanTaskSchema = z
  .object({
    name: taskName,
    intervalKm: interval(1_000_000).optional(),
    intervalDays: interval(3650).optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .refine((task) => (task.intervalKm ?? null) !== null || (task.intervalDays ?? null) !== null, {
    message: NEEDS_INTERVAL,
    path: ['intervalKm'],
  });
export type CreatePlanTaskInput = z.infer<typeof createPlanTaskSchema>;

/** `PATCH /fleet/maintenance/plan/:id`. `isActive: false` la saca de los cálculos (no borra). */
export const updatePlanTaskSchema = z
  .object({
    name: taskName,
    intervalKm: interval(1_000_000),
    intervalDays: interval(3650),
    sortOrder: z.number().int().min(0).max(10_000),
    isActive: z.boolean(),
  })
  .partial();
export type UpdatePlanTaskInput = z.infer<typeof updatePlanTaskSchema>;

/** El mensaje cuando un cambio deja a la tarea sin km ni días. */
export const PLAN_TASK_NEEDS_INTERVAL = NEEDS_INTERVAL;

const uuid = (message: string) => z.uuid({ message });

/**
 * `POST /fleet/maintenance/logs`: un servicio, de una o varias tareas. Acepta
 * `taskIds` o un `taskId` suelto; sale siempre como `taskIds`.
 */
export const createMaintenanceLogSchema = z
  .object({
    vehicleId: uuid('Elegí el carro.'),
    taskIds: z.array(uuid('Esa tarea no existe.')).max(20).optional(),
    taskId: uuid('Esa tarea no existe.').optional(),
    performedAt: civilDateSchema,
    odometerKm: odometer.nullable().optional(),
    cost: moneySchema.nullable().optional(),
    shop: optionalText(80),
    notes: optionalText(1000),
  })
  .transform(({ taskId, taskIds, ...rest }) => ({
    ...rest,
    taskIds: [...new Set([...(taskIds ?? []), ...(taskId === undefined ? [] : [taskId])])],
  }))
  .refine((log) => log.taskIds.length > 0, {
    message: 'Marcá al menos una tarea.',
    path: ['taskIds'],
  });
export type CreateMaintenanceLogInput = z.infer<typeof createMaintenanceLogSchema>;

/** `GET /fleet/maintenance/logs?vehicleId&taskId&page&pageSize` → `Page<MaintenanceLog>` (101). */
export const maintenanceLogsQuerySchema = z.object({
  ...pageQueryShape,
  vehicleId: uuid('Ese carro no existe.').optional(),
  taskId: uuid('Esa tarea no existe.').optional(),
});
export type MaintenanceLogsQuery = z.infer<typeof maintenanceLogsQuerySchema>;

/**
 * Qué carros trae una página del estado (101): los que tienen algo pendiente
 * (`pending`) o los que tienen una tarea sin último servicio (`no_data`). Sin
 * esto, todos.
 */
export const MAINTENANCE_STATUS_VIEWS = ['pending', 'no_data'] as const;
export type MaintenanceStatusView = (typeof MAINTENANCE_STATUS_VIEWS)[number];

/**
 * `GET /fleet/maintenance/status?vehicleId&days&view&page&pageSize` →
 * {@link MaintenanceStatusList}.
 */
export const maintenanceStatusQuerySchema = z.object({
  ...pageQueryShape,
  view: z.enum(MAINTENANCE_STATUS_VIEWS, { message: 'Esa vista no existe.' }).optional(),
  vehicleId: uuid('Ese carro no existe.').optional(),
  days: z.coerce
    .number({ message: 'Escribí los días.' })
    .int({ message: 'Tiene que ser un número entero.' })
    .min(1, { message: 'Tiene que ser al menos un día.' })
    .max(365, { message: 'No puede pasar de 365.' })
    .optional(),
});
export type MaintenanceStatusQuery = z.infer<typeof maintenanceStatusQuerySchema>;

const expenseShape = {
  vehicleId: uuid('Elegí el carro.'),
  type: z.enum(FLEET_EXPENSE_TYPES, { message: 'Elegí el tipo de gasto.' }),
  amount: positiveMoney,
  incurredAt: civilDateSchema,
  odometerKm: odometer.nullable().optional(),
  description: optionalText(300),
};

/** `POST /fleet/expenses`: un gasto manual (RN-3). */
export const createFleetExpenseSchema = z.object(expenseShape);
export type CreateFleetExpenseInput = z.infer<typeof createFleetExpenseSchema>;

/** `PATCH /fleet/expenses/:id`: solo un gasto manual que no viene de un servicio. */
export const updateFleetExpenseSchema = z.object(expenseShape).partial();
export type UpdateFleetExpenseInput = z.infer<typeof updateFleetExpenseSchema>;

/** `GET /fleet/expenses?vehicleId&type&from&to&page&pageSize`. Fechas inclusive. */
export const fleetExpensesQuerySchema = z.object({
  ...pageQueryShape,
  vehicleId: uuid('Ese carro no existe.').optional(),
  type: z.enum(FLEET_EXPENSE_TYPES, { message: 'Ese tipo de gasto no existe.' }).optional(),
  from: civilDateSchema.optional(),
  to: civilDateSchema.optional(),
});
export type FleetExpensesQuery = z.infer<typeof fleetExpensesQuerySchema>;

// ===================== Cuentas puras =====================

const DAY_MS = 24 * 60 * 60 * 1000;

/** Días civiles de `from` a `to` (`YYYY-MM-DD`); negativo si `to` es antes. */
export function civilDaysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** Los avisos de los ajustes (095): cuántos km o días antes es «próximo». */
export interface MaintenanceAlerts {
  kmAlert: number;
  daysAlert: number;
}

export interface TaskStatusInput {
  task: Pick<MaintenancePlanTask, 'intervalKm' | 'intervalDays'>;
  /** El servicio más reciente de esa tarea en ese carro, o `null`. */
  last: { performedAt: string; odometerKm: number | null } | null;
  /** El kilometraje actual del carro. */
  odometerKm: number;
  /** Hoy, `YYYY-MM-DD` en la zona del taller. */
  today: string;
  alerts: MaintenanceAlerts;
}

export interface TaskStatusResult {
  status: MaintenanceStatus;
  kmLeft: number | null;
  daysLeft: number | null;
  score: number | null;
}

/**
 * El estado de una tarea en un carro (RN-1).
 *
 * `kmLeft = intervalKm − (odómetro − km del último)` si la tarea mide km y el
 * último servicio anotó km; `daysLeft = intervalDays − días desde el último`
 * si mide días. `DUE` si alguno es `<= 0`; `SOON` si alguno llega al aviso; si
 * no, `OK`. Sin servicio, o sin nada que medir, `NO_DATA`. `score` es el menor
 * de los dos normalizados por su intervalo.
 */
export function taskStatus(input: TaskStatusInput): TaskStatusResult {
  const { task, last, odometerKm, today, alerts } = input;
  const empty: TaskStatusResult = { status: 'NO_DATA', kmLeft: null, daysLeft: null, score: null };

  if (last === null) return empty;

  const kmLeft =
    task.intervalKm !== null && last.odometerKm !== null
      ? task.intervalKm - (odometerKm - last.odometerKm)
      : null;
  const daysLeft =
    task.intervalDays !== null
      ? task.intervalDays - civilDaysBetween(last.performedAt, today)
      : null;

  if (kmLeft === null && daysLeft === null) return empty;

  const ratios = [
    kmLeft === null || task.intervalKm === null ? null : kmLeft / task.intervalKm,
    daysLeft === null || task.intervalDays === null ? null : daysLeft / task.intervalDays,
  ].filter((ratio): ratio is number => ratio !== null);
  const score = Math.min(...ratios);

  const due = (kmLeft !== null && kmLeft <= 0) || (daysLeft !== null && daysLeft <= 0);
  const soon =
    (kmLeft !== null && kmLeft <= alerts.kmAlert) ||
    (daysLeft !== null && daysLeft <= alerts.daysAlert);

  return { status: due ? 'DUE' : soon ? 'SOON' : 'OK', kmLeft, daysLeft, score };
}

/**
 * El estado de un vencimiento (RN-6): `DUE` si ya pasó, `SOON` si faltan
 * `daysAlert` días o menos, `null` si todavía falta o no hay fecha.
 */
export function documentStatus(
  expiresAt: string | null,
  today: string,
  daysAlert: number,
): { status: DocumentStatus; daysLeft: number } | null {
  if (expiresAt === null) return null;

  const daysLeft = civilDaysBetween(today, expiresAt);

  if (daysLeft < 0) return { status: 'DUE', daysLeft };
  if (daysLeft <= daysAlert) return { status: 'SOON', daysLeft };

  return null;
}

/** Orden de urgencia: vencido, próximo, al día, sin dato. */
export const MAINTENANCE_STATUS_ORDER: Record<MaintenanceStatus, number> = {
  DUE: 0,
  SOON: 1,
  OK: 2,
  NO_DATA: 3,
};

/** Lo que va en la lista de pendientes: vencido o próximo. */
export function isPendingTask(task: Pick<MaintenanceTaskStatus, 'status'>): boolean {
  return task.status === 'DUE' || task.status === 'SOON';
}

/** Un carro con algo pendiente: una tarea vencida o próxima, o un documento por vencer. */
export function hasPendingMaintenance(
  status: Pick<VehicleMaintenanceStatus, 'tasks' | 'documents'>,
): boolean {
  return status.tasks.some(isPendingTask) || status.documents.length > 0;
}

/** Un carro al que le falta cargar el último servicio de alguna tarea. */
export function hasMissingMaintenanceData(
  status: Pick<VehicleMaintenanceStatus, 'tasks'>,
): boolean {
  return status.tasks.some((task) => task.status === 'NO_DATA');
}

/** ¿Entra el carro en esa vista del estado (101)? Sin vista, todos. */
export function inMaintenanceView(
  status: Pick<VehicleMaintenanceStatus, 'tasks' | 'documents'>,
  view: MaintenanceStatusView | undefined,
): boolean {
  if (view === 'pending') return hasPendingMaintenance(status);
  if (view === 'no_data') return hasMissingMaintenanceData(status);

  return true;
}

/** Las cifras de arriba de Mantenimiento, sobre todos los carros que se pasan. */
export function maintenanceSummary(
  statuses: readonly Pick<VehicleMaintenanceStatus, 'tasks' | 'documents'>[],
): MaintenanceSummary {
  const tasks = statuses.flatMap((status) => status.tasks);

  return {
    due: tasks.filter((task) => task.status === 'DUE').length,
    soon: tasks.filter((task) => task.status === 'SOON').length,
    noData: statuses.filter(hasMissingMaintenanceData).length,
    documents: statuses.reduce((sum, status) => sum + status.documents.length, 0),
  };
}
