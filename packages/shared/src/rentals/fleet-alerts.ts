import type { MaintenanceTaskStatus, VehicleDocumentStatus } from './maintenance';
import { VEHICLE_DOCUMENT_LABELS, isPendingTask } from './maintenance';

/**
 * spec 110 — Los textos de los avisos de un carro y de «qué hay que hacer».
 *
 * El estado (vencido, próximo) lo calcula el API. Estas funciones solo arman
 * la frase, para que la lista, la ficha y los tests digan lo mismo.
 */

export interface FleetAlertInput {
  tasks: readonly MaintenanceTaskStatus[];
  documents: readonly VehicleDocumentStatus[];
  odometerKm: number;
  /** Hoy, `YYYY-MM-DD` en la zona del taller. */
  today: string;
}

const MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const;

/** `50000` → `"50.000"`. */
export function formatKm(value: number): string {
  const sign = value < 0 ? '-' : '';
  const digits = String(Math.abs(Math.trunc(value)));

  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** `"2026-10-12"` → `"12 oct"`. */
export function shortCivil(civil: string): string {
  const day = Number(civil.slice(8, 10));
  const month = MONTHS[Number(civil.slice(5, 7)) - 1] ?? '';

  return `${day} ${month}`;
}

function addDays(civil: string, days: number): string {
  return new Date(Date.parse(`${civil}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

function dayCount(days: number): string {
  return days === 1 ? '1 día' : `${days} días`;
}

type Binding = 'km' | 'days';

/** Qué medida manda la frase: el km si está vencido o es el que aprieta más. */
function binding(
  task: Pick<MaintenanceTaskStatus, 'kmLeft' | 'daysLeft' | 'task'>,
): Binding | null {
  const kmDue = task.kmLeft !== null && task.kmLeft <= 0;
  const daysDue = task.daysLeft !== null && task.daysLeft <= 0;

  if (kmDue) return 'km';
  if (daysDue) return 'days';
  if (task.kmLeft === null && task.daysLeft === null) return null;
  if (task.kmLeft === null) return 'days';
  if (task.daysLeft === null) return 'km';

  const kmRatio = task.task.intervalKm === null ? task.kmLeft : task.kmLeft / task.task.intervalKm;
  const daysRatio =
    task.task.intervalDays === null ? task.daysLeft : task.daysLeft / task.task.intervalDays;

  return kmRatio <= daysRatio ? 'km' : 'days';
}

function targetKm(odometerKm: number, kmLeft: number): number {
  return odometerKm + kmLeft;
}

/**
 * La línea de «Qué hay que hacer»: «Le toca a los 50.000 km» o «Le toca el 12 oct».
 * `null` si la tarea no está vencida ni próxima.
 */
export function pendingServiceLine(
  task: Pick<MaintenanceTaskStatus, 'status' | 'kmLeft' | 'daysLeft' | 'task'>,
  odometerKm: number,
  today: string,
): string | null {
  if (!isPendingTask(task)) return null;

  const which = binding(task);

  if (which === 'km' && task.kmLeft !== null) {
    return `Le toca a los ${formatKm(targetKm(odometerKm, task.kmLeft))} km`;
  }
  if (which === 'days' && task.daysLeft !== null) {
    return `Le toca el ${shortCivil(addDays(today, task.daysLeft))}`;
  }

  return null;
}

function serviceAlertText(
  task: MaintenanceTaskStatus,
  odometerKm: number,
  today: string,
): string | null {
  const which = binding(task);
  const name = task.task.name;

  if (which === 'km' && task.kmLeft !== null) {
    const target = formatKm(targetKm(odometerKm, task.kmLeft));

    return task.status === 'DUE'
      ? `Se pasó: ${name} iba a los ${target} y va en ${formatKm(odometerKm)}`
      : `Le toca ${name} a los ${target} km`;
  }
  if (which === 'days' && task.daysLeft !== null) {
    const when = shortCivil(addDays(today, task.daysLeft));

    return task.status === 'DUE' ? `Se pasó: ${name} iba el ${when}` : `Le toca ${name} el ${when}`;
  }

  return null;
}

function documentAlertText(document: VehicleDocumentStatus): string {
  const label = VEHICLE_DOCUMENT_LABELS[document.kind];

  if (document.status === 'DUE') {
    return `${label} venció hace ${dayCount(Math.abs(document.daysLeft))}`;
  }
  if (document.daysLeft === 0) return `${label} vence hoy`;

  return `${label} vence en ${dayCount(document.daysLeft)}`;
}

export interface BuiltFleetAlert {
  kind: 'DOCUMENT' | 'SERVICE';
  text: string;
  level: 'WARN' | 'DUE';
}

/** Avisos de papeles y de servicio, vencidos primero. */
export function fleetAlerts(input: FleetAlertInput): BuiltFleetAlert[] {
  const documents = input.documents.map((document) => ({
    kind: 'DOCUMENT' as const,
    level: document.status === 'DUE' ? ('DUE' as const) : ('WARN' as const),
    text: documentAlertText(document),
  }));
  const services = input.tasks.flatMap((task) => {
    if (!isPendingTask(task)) return [];

    const text = serviceAlertText(task, input.odometerKm, input.today);

    return text === null
      ? []
      : [
          {
            kind: 'SERVICE' as const,
            level: task.status === 'DUE' ? ('DUE' as const) : ('WARN' as const),
            text,
          },
        ];
  });

  return [...documents, ...services].sort((left, right) =>
    left.level === right.level ? 0 : left.level === 'DUE' ? -1 : 1,
  );
}
