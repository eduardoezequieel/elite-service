import { isCivil, type CivilDate, type CivilRange } from '@/lib/civil-date';
import { RANGE_END_PARAM, RANGE_START_PARAM, commissionRangeFrom } from './commission-range';

/**
 * Lo puro de Rendimiento (spec 067): el estado que viaja en la URL y las
 * palabras con que se dicen los números. Sin React, para poder probarlo.
 */

export const PERFORMANCE_PATH = '/carwash/performance';

export const PERFORMANCE_TABS = ['summary', 'commissions', 'times', 'extras', 'loyalty'] as const;
export type PerformanceTab = (typeof PERFORMANCE_TABS)[number];

export const PERFORMANCE_TAB_LABELS: Record<PerformanceTab, string> = {
  summary: 'Resumen',
  commissions: 'Comisiones',
  times: 'Tiempos',
  extras: 'Extras',
  loyalty: 'Clientes fieles',
};

/** Los nombres de los parámetros. El rango reusa `start`/`end` de la 061. */
export const TAB_PARAM = 'tab';
export const EMPLOYEE_PARAM = 'employee';

/** Lo que la pantalla guarda en la URL: pestaña, alcance y rango. */
export interface PerformanceView {
  tab: PerformanceTab;
  /** `null` = todo el equipo. */
  employeeId: string | null;
  range: CivilRange;
}

type SearchValue = string | string[] | undefined | null;

function single(value: SearchValue): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function isTab(value: string | null): value is PerformanceTab {
  return value !== null && (PERFORMANCE_TABS as readonly string[]).includes(value);
}

/** La vista de la URL. Lo que no se entiende cae a Resumen, equipo y «Este mes». */
export function performanceViewFrom(values: {
  tab?: SearchValue;
  employee?: SearchValue;
  start?: SearchValue;
  end?: SearchValue;
}): PerformanceView {
  const tab = single(values.tab);

  return {
    tab: isTab(tab) ? tab : 'summary',
    employeeId: single(values.employee),
    range: commissionRangeFrom(values.start, values.end),
  };
}

/** `tab=…&employee=…&start=…&end=…`. Resumen y el equipo no se escriben. */
export function performanceQuery(view: PerformanceView): string {
  const params = new URLSearchParams();
  if (view.tab !== 'summary') params.set(TAB_PARAM, view.tab);
  if (view.employeeId !== null) params.set(EMPLOYEE_PARAM, view.employeeId);
  params.set(RANGE_START_PARAM, view.range.from);
  params.set(RANGE_END_PARAM, view.range.to);

  return params.toString();
}

export function performanceHref(view: PerformanceView): string {
  return `${PERFORMANCE_PATH}?${performanceQuery(view)}`;
}

/**
 * A dónde manda una URL vieja de Comisiones (009/061): pestaña Comisiones, el
 * mismo empleado y el mismo rango. Un rango roto no se copia: sin él la
 * pantalla arranca en «Este mes», igual que antes.
 */
export function commissionsRedirectHref(values: {
  employee?: SearchValue;
  start?: SearchValue;
  end?: SearchValue;
}): string {
  const params = new URLSearchParams({ [TAB_PARAM]: 'commissions' });
  const employee = single(values.employee);
  if (employee !== null) params.set(EMPLOYEE_PARAM, employee);

  const start = single(values.start);
  const end = single(values.end);
  if (start !== null && end !== null && isCivil(start) && isCivil(end) && start <= end) {
    params.set(RANGE_START_PARAM, start);
    params.set(RANGE_END_PARAM, end);
  }

  return `${PERFORMANCE_PATH}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Palabras
// ---------------------------------------------------------------------------

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Porcentaje entero, o `null` sin base. */
export function percent(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 100);
}

/** `34 min`, o `—` sin medir. El API manda un decimal; se muestra entero. */
export function formatMinutes(minutes: number | null): string {
  return minutes === null ? '—' : `${Math.round(minutes)} min`;
}

/** Tono de una comparación. Nunca va solo: siempre acompaña a la palabra. */
export type DeltaTone = 'go' | 'warn' | 'neutral';

export interface Delta {
  text: string;
  tone: DeltaTone;
}

/**
 * Minutos contra el promedio del equipo, en palabras. Negativo = más rápido.
 * `short` quita el «que el promedio» para las columnas angostas.
 */
export function minutesDelta(delta: number | null, short = false): Delta {
  if (delta === null) return { text: 'sin medir', tone: 'neutral' };
  const rounded = Math.round(delta);
  if (rounded === 0) return { text: 'en el promedio', tone: 'neutral' };
  const tail = short ? '' : ' que el promedio';

  return rounded < 0
    ? { text: `${-rounded} min más rápido${tail}`, tone: 'go' }
    : { text: `${rounded} min más lento${tail}`, tone: 'warn' };
}

/** Puntos porcentuales contra el equipo; más es mejor. */
export function pointsDelta(mine: number | null, team: number | null): Delta {
  if (mine === null || team === null) return { text: '', tone: 'neutral' };
  const difference = mine - team;
  if (difference === 0) return { text: 'igual', tone: 'neutral' };

  return difference > 0
    ? { text: `${plural(difference, 'punto', 'puntos')} más`, tone: 'go' }
    : { text: `${plural(-difference, 'punto', 'puntos')} menos`, tone: 'warn' };
}

const SHORT_MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sept',
  'oct',
  'nov',
  'dic',
] as const;

function dayMonth(civil: CivilDate): { day: number; month: string; key: string } {
  const month = Number(civil.slice(5, 7));

  return {
    day: Number(civil.slice(8, 10)),
    month: SHORT_MONTHS[month - 1] ?? '',
    key: civil.slice(0, 7),
  };
}

/** `26 sept`, `1 – 26 sept`, `28 ago – 3 sept`. */
export function rangeLabel(from: CivilDate, to: CivilDate): string {
  const start = dayMonth(from);
  const end = dayMonth(to);
  if (from === to) return `${end.day} ${end.month}`;
  if (start.key === end.key) return `${start.day} – ${end.day} ${end.month}`;

  return `${start.day} ${start.month} – ${end.day} ${end.month}`;
}

/** `Carlos Méndez` → `Carlos`. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/u)[0] ?? fullName;
}

/** Centavos enteros → `$12.50`. */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(Math.round(cents));

  return `${sign}$${Math.trunc(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}

/**
 * El tope de la escala de un gráfico de barras: el valor más alto —o la marca
 * del promedio, si queda más lejos— con un 8% de aire para que ninguna barra
 * toque el borde. 0 si no hay nada que dibujar.
 */
export function barScaleMax(values: readonly number[], average: number | null = null): number {
  const top = Math.max(0, average ?? 0, ...values);

  return top * 1.08;
}
