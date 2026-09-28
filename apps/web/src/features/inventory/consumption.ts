import type { EmployeeConsumptionEntry } from '@elite/shared';

import { isCivil, presetRange, todayCivil, type CivilRange } from '@/lib/civil-date';
import { singleParam, type SearchValue } from '@/lib/list-params';
import { formatCents, formatMoney } from '@/lib/money';
import { formatQuantity, quantityMilli } from '@/lib/quantity';

/**
 * Consumos del personal (spec 070, rango de la 091): qué fechas se miran, las
 * rutas de las dos pantallas y el valor de lo que se anota.
 *
 * El rango es civil de `America/El_Salvador` (091 RN-4) y viaja en la URL como
 * `?start=&end=`, para que el detalle de un trabajador vuelva al reporte con
 * las mismas fechas (056). `from` no se usa: es el origen del regreso.
 */

export const CONSUMPTION_START_PARAM = 'start';
export const CONSUMPTION_END_PARAM = 'end';

export const CONSUMPTION_REPORT_PATH = '/inventory/consumption';

/** El rango de la URL si es válido; si no, el mes en curso hasta hoy. */
export function consumptionRangeFrom(
  params: Record<string, SearchValue>,
  today: string = todayCivil(),
): CivilRange {
  const start = singleParam(params[CONSUMPTION_START_PARAM]);
  const end = singleParam(params[CONSUMPTION_END_PARAM]);

  return start !== null && end !== null && isCivil(start) && isCivil(end) && start <= end
    ? { from: start, to: end }
    : presetRange('month', today);
}

/** `start=2026-09-01&end=2026-09-28`. */
export function consumptionRangeQuery(range: CivilRange): string {
  return new URLSearchParams({
    [CONSUMPTION_START_PARAM]: range.from,
    [CONSUMPTION_END_PARAM]: range.to,
  }).toString();
}

export function consumptionReportHref(range: CivilRange): string {
  return `${CONSUMPTION_REPORT_PATH}?${consumptionRangeQuery(range)}`;
}

export function consumptionDetailHref(employeeId: string, range: CivilRange): string {
  return `${CONSUMPTION_REPORT_PATH}/${employeeId}?${consumptionRangeQuery(range)}`;
}

/** `"1.25"` → `125`, o `null` si no es un monto. */
export function priceCents(price: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(price.trim());
  if (match === null) return null;

  const [, whole, fraction = ''] = match;

  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
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
