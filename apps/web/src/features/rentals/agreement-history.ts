import type { AgreementStatus } from '@elite/shared';

import { addDays, addMonths, type CivilDate } from '@/lib/civil-date';

/**
 * El Historial de rentas (117): lo cerrado y lo cancelado, de un mes a la vez.
 * Con texto en el buscador se ignora el mes. Puro.
 */

/** De a cuántas rentas se pagina el Historial. */
export const HISTORY_PAGE_SIZE = 15;

/** «Todas · Cerradas · Canceladas». Falta o no se reconoce: «Todas». */
export const HISTORY_FILTERS = ['ALL', 'FINISHED', 'CANCELLED'] as const;
export type HistoryFilter = (typeof HISTORY_FILTERS)[number];

export function historyFilter(status: string | null | undefined): HistoryFilter {
  return HISTORY_FILTERS.find((filter) => filter === status) ?? 'ALL';
}

/** Un mes: `YYYY-MM`. */
export type Month = string;

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** El mes de un día civil. */
export function monthOf(day: CivilDate): Month {
  return day.slice(0, 7);
}

/**
 * El mes que pide la URL, si es un mes de verdad y no pasa del actual. Si no,
 * el actual.
 */
export function historyMonth(value: string | null | undefined, today: CivilDate): Month {
  const current = monthOf(today);
  if (value === null || value === undefined || !MONTH_RE.test(value)) return current;

  return value > current ? current : value;
}

/** El mes `count` meses antes o después. */
export function shiftMonth(month: Month, count: number): Month {
  return monthOf(addMonths(`${month}-01`, count));
}

/** Primer y último día del mes: el `from`/`to` que viaja al API. */
export function monthBounds(month: Month): { from: CivilDate; to: CivilDate } {
  const from = `${month}-01`;

  return { from, to: addDays(addMonths(from, 1), -1) };
}

const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

/** «septiembre 2026». */
export function monthTitle(month: Month): string {
  return `${MONTH_NAMES[Number(month.slice(5, 7)) - 1] ?? ''} ${month.slice(0, 4)}`;
}

/** Lo que pide el Historial al API, sin la página. */
export function historyQuery({
  filter,
  month,
  vehicleId,
  search,
}: {
  filter: HistoryFilter;
  month: Month;
  vehicleId: string | null;
  search: string;
}): {
  status: AgreementStatus[];
  from?: CivilDate;
  to?: CivilDate;
  vehicleId?: string;
  q?: string;
} {
  const status: AgreementStatus[] = filter === 'ALL' ? ['FINISHED', 'CANCELLED'] : [filter];

  return {
    status,
    ...(search === '' ? monthBounds(month) : { q: search }),
    ...(vehicleId === null ? {} : { vehicleId }),
  };
}
