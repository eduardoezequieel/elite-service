import type { EmployeeConsumptionEntry } from '@elite/shared';

import { addMonths, monthLabel, todayCivil } from '@/lib/civil-date';
import { formatMoney, formatQuantity, quantityMilli } from './format';

/**
 * Consumo de empleados (spec 070): el mes que se mira, cómo se pasa de uno a
 * otro, las rutas de las dos pantallas y el valor de lo que se anota.
 *
 * El mes es civil de `America/El_Salvador` (RN-5) y viaja en la URL como
 * `?month=YYYY-MM`, para que el detalle de un trabajador vuelva al reporte del
 * mismo mes (056).
 */

/** `YYYY-MM`. */
export type ConsumptionMonth = string;

export const CONSUMPTION_MONTH_PARAM = 'month';

export const CONSUMPTION_REPORT_PATH = '/inventory/consumption';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

type SearchValue = string | string[] | undefined | null;

export function isConsumptionMonth(value: string): boolean {
  return MONTH_RE.test(value);
}

/** El mes en curso en el taller, no en el huso del navegador. */
export function currentConsumptionMonth(now: Date = new Date()): ConsumptionMonth {
  return todayCivil(now).slice(0, 7);
}

/** El mes de la URL si es válido; si no, el actual. */
export function consumptionMonthFrom(value: SearchValue, now?: Date): ConsumptionMonth {
  return typeof value === 'string' && isConsumptionMonth(value)
    ? value
    : currentConsumptionMonth(now);
}

/** Un mes para atrás (`-1`) o para adelante (`+1`), cruzando el año si toca. */
export function shiftConsumptionMonth(month: ConsumptionMonth, delta: number): ConsumptionMonth {
  return addMonths(`${month}-01`, delta).slice(0, 7);
}

/** Todavía no pasó: no hay consumos que mirar. */
export function isAfterCurrentMonth(month: ConsumptionMonth, now?: Date): boolean {
  return month > currentConsumptionMonth(now);
}

/** `2026-09` → «Septiembre 2026». */
export function consumptionMonthTitle(month: ConsumptionMonth): string {
  const label = monthLabel(`${month}-01`);

  return label.charAt(0).toLocaleUpperCase('es-SV') + label.slice(1);
}

/** `month=2026-09`. */
export function consumptionMonthQuery(month: ConsumptionMonth): string {
  return new URLSearchParams({ [CONSUMPTION_MONTH_PARAM]: month }).toString();
}

export function consumptionReportHref(month: ConsumptionMonth): string {
  return `${CONSUMPTION_REPORT_PATH}?${consumptionMonthQuery(month)}`;
}

export function consumptionDetailHref(employeeId: string, month: ConsumptionMonth): string {
  return `${CONSUMPTION_REPORT_PATH}/${employeeId}?${consumptionMonthQuery(month)}`;
}

/** `"1.25"` → `125`, o `null` si no es un monto. */
export function priceCents(price: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(price.trim());
  if (match === null) return null;

  const [, whole, fraction = ''] = match;

  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

/** `250` → `"$2.50"`. */
export function formatCents(cents: number): string {
  return formatMoney(`${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, '0')}`);
}

/**
 * «2 × $1.25 = $2.50»: lo que vale lo anotado a precio de venta (RN-4), antes
 * de mandarlo. `null` mientras la cantidad no sea un número mayor que cero.
 * Se cuenta en milésimas por centavos, nunca con coma flotante; el redondeo a
 * centavo es hacia arriba desde la mitad.
 */
export function consumptionValueLine(quantity: string, price: string): string | null {
  const milli = quantityMilli(quantity);
  const cents = priceCents(price);
  if (milli === null || milli <= 0 || cents === null) return null;

  const total = Math.round((milli * cents) / 1000);

  return `${formatQuantity(quantity)} × ${formatMoney(price)} = ${formatCents(total)}`;
}

/** Un consumo anulado no cuenta (RN-5): se ve tachado, con su motivo. */
export function isReversed(entry: EmployeeConsumptionEntry): boolean {
  return entry.reversal !== null;
}
