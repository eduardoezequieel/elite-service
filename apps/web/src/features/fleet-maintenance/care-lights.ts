import {
  VEHICLE_DOCUMENT_LABELS,
  civilDaysBetween,
  documentStatus,
  formatKm,
  shortCivil,
} from '@elite/shared';
import type { MaintenanceStatus, MaintenanceTaskStatus, VehicleDocumentKind } from '@elite/shared';

/**
 * El tablero de «Servicio y gastos» (122): un testigo por tarea del plan y uno
 * por papel, y el medidor con lo más urgente. Puro: el estado de las tareas lo
 * calcula el API; acá se elige el tono, el ícono y las frases.
 */

/** Rojo vencido, ámbar pronto, apagado al día, gris sin dato. */
export type LightTone = 'due' | 'soon' | 'ok' | 'none';

export const LIGHT_TONE: Record<MaintenanceStatus, LightTone> = {
  DUE: 'due',
  SOON: 'soon',
  OK: 'ok',
  NO_DATA: 'none',
};

export type LightIcon =
  | 'oil'
  | 'brakes'
  | 'tires'
  | 'alignment'
  | 'air'
  | 'battery'
  | 'coolant'
  | 'insurance'
  | 'registration'
  | 'wrench';

export interface CareLight {
  /** `task:<id>` o `doc:<kind>`. */
  key: string;
  kind: 'task' | 'document';
  /** La tarea del plan, si es un testigo de servicio. */
  taskId: string | null;
  /** El papel, si es un testigo de papeles. */
  document: VehicleDocumentKind | null;
  name: string;
  status: MaintenanceStatus;
  tone: LightTone;
  icon: LightIcon;
  /** Lo que va debajo del nombre en el testigo. */
  state: string;
  /** La misma idea en minúscula, para la línea del medidor. */
  detail: string;
  /** Cuánto se gastó del intervalo, de 0 (recién hecho) a 1 (toca). */
  used: number;
}

/** Las palabras de la clave que dicen qué ícono le va. La clave la arma el API con el nombre. */
const ICON_WORDS: readonly [LightIcon, readonly string[]][] = [
  ['oil', ['oil', 'aceite']],
  ['brakes', ['brake', 'freno']],
  ['tires', ['tire', 'llanta']],
  ['alignment', ['align', 'alinea']],
  ['air', ['air', 'aire']],
  ['battery', ['batter', 'bateria']],
  ['coolant', ['coolant', 'refrigerante']],
];

/** El ícono de una tarea por su clave; la llave inglesa si no se reconoce. */
export function taskIcon(key: string): LightIcon {
  const text = key.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const match = ICON_WORDS.find(([, words]) => words.some((word) => text.includes(word)));

  return match?.[0] ?? 'wrench';
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function days(count: number): string {
  return count === 1 ? '1 día' : `${count} días`;
}

/** «hoy», «mañana», «en 5 días». */
function whenAhead(daysLeft: number): string {
  if (daysLeft === 0) return 'hoy';
  if (daysLeft === 1) return 'mañana';

  return `en ${days(daysLeft)}`;
}

/** Qué medida aprieta más: la que tiene menos intervalo por delante. */
function binding(task: MaintenanceTaskStatus): 'km' | 'days' | null {
  const km =
    task.kmLeft === null || task.task.intervalKm === null
      ? null
      : task.kmLeft / task.task.intervalKm;
  const day =
    task.daysLeft === null || task.task.intervalDays === null
      ? null
      : task.daysLeft / task.task.intervalDays;

  if (km === null && day === null) return null;
  if (km === null) return 'days';
  if (day === null) return 'km';

  return km <= day ? 'km' : 'days';
}

function taskDetail(task: MaintenanceTaskStatus): string {
  const which = binding(task);

  if (task.status === 'NO_DATA' || which === null) return 'sin dato';

  if (which === 'km' && task.kmLeft !== null) {
    if (task.status === 'DUE') {
      return task.kmLeft < 0 ? `${formatKm(-task.kmLeft)} km de más` : 'llegó al km';
    }

    return `quedan ${formatKm(task.kmLeft)} km`;
  }

  const left = task.daysLeft ?? 0;

  if (task.status === 'DUE') return left < 0 ? `venció hace ${days(-left)}` : 'vence hoy';

  return `toca ${whenAhead(left)}`;
}

/** El testigo de una tarea del plan. */
export function taskLight(task: MaintenanceTaskStatus): CareLight {
  const detail = taskDetail(task);
  const used =
    task.status === 'NO_DATA' || task.score === null
      ? 0
      : task.status === 'DUE'
        ? 1
        : clamp(1 - task.score);

  return {
    key: `task:${task.task.id}`,
    kind: 'task',
    taskId: task.task.id,
    document: null,
    name: task.task.name,
    status: task.status,
    tone: LIGHT_TONE[task.status],
    icon: taskIcon(task.task.key),
    state: task.status === 'OK' ? 'Bien' : capitalize(detail),
    detail,
    used,
  };
}

/** El testigo de un papel: Seguro o Tarjeta de circulación, con `documentStatus` del contrato. */
export function documentLight(
  kind: VehicleDocumentKind,
  expiresAt: string | null,
  today: string,
  daysAlert: number,
): CareLight {
  const base = {
    key: `doc:${kind}`,
    kind: 'document' as const,
    taskId: null,
    document: kind,
    name: VEHICLE_DOCUMENT_LABELS[kind],
    icon: kind === 'INSURANCE' ? ('insurance' as const) : ('registration' as const),
  };

  if (expiresAt === null) {
    return {
      ...base,
      status: 'NO_DATA',
      tone: 'none',
      state: 'Sin fecha',
      detail: 'sin fecha',
      used: 0,
    };
  }

  const result = documentStatus(expiresAt, today, daysAlert);
  const daysLeft = civilDaysBetween(today, expiresAt);
  let status: MaintenanceStatus = 'OK';
  let detail = `vence el ${shortCivil(expiresAt)}`;

  if (result?.status === 'DUE') {
    status = 'DUE';
    detail = `venció hace ${days(-result.daysLeft)}`;
  } else if (result?.status === 'SOON') {
    status = 'SOON';
    detail = `vence ${whenAhead(result.daysLeft)}`;
  }

  return {
    ...base,
    status,
    tone: LIGHT_TONE[status],
    state: capitalize(detail),
    detail,
    used: status === 'DUE' ? 1 : clamp((365 - daysLeft) / 365),
  };
}

const RANK: Record<MaintenanceStatus, number> = { DUE: 0, SOON: 1, OK: 2, NO_DATA: 3 };

/**
 * Lo que marca el medidor: lo vencido o próximo que más aprieta; si no hay,
 * lo que está al día y más gastado; sin nada anotado, `null`.
 */
export function dialFocus(lights: readonly CareLight[]): CareLight | null {
  const ranked = lights
    .filter((light) => light.status !== 'NO_DATA')
    .sort((left, right) => RANK[left.status] - RANK[right.status] || right.used - left.used);

  return ranked[0] ?? null;
}

/** La línea debajo del medidor, en partes para poner el nombre en negrita. */
export type DialCaption =
  | { kind: 'empty'; text: string }
  | { kind: 'urgent' | 'next'; lead: string; name: string; detail: string };

export function dialCaption(focus: CareLight | null): DialCaption {
  if (focus === null) return { kind: 'empty', text: 'Todavía no hay nada anotado.' };
  if (focus.status === 'DUE' || focus.status === 'SOON') {
    return { kind: 'urgent', lead: 'Lo más urgente:', name: focus.name, detail: focus.detail };
  }

  return { kind: 'next', lead: 'Todo bien. Lo próximo es', name: focus.name, detail: focus.detail };
}

/** El ángulo de la aguja, de −90° (recién hecho) a 90° (toca). */
export function needleAngle(used: number): number {
  return -90 + clamp(used) * 180;
}

/** Los dígitos del odómetro: seis como mínimo, con ceros a la izquierda. */
export function odometerDigits(km: number): string[] {
  return String(Math.max(0, Math.trunc(km)))
    .padStart(6, '0')
    .split('');
}

/** Cuántos testigos están encendidos: vencidos o próximos. */
export function litCount(lights: readonly CareLight[]): number {
  return lights.filter((light) => light.status === 'DUE' || light.status === 'SOON').length;
}
