import { centsToMoney, moneyToCents, monthThroughToday } from '@elite/shared';
import type { VehicleLifetime, VehicleMonthRow, Verdict } from '@elite/shared';

import type { StampTone } from '@/components/ui/stamp';
import { addMonths, firstOfMonth, type CivilDate, type CivilRange } from '@/lib/civil-date';
import { formatCents } from '@/lib/money';

/** Solo presentación de la rentabilidad (100): los números llegan hechos. */

export const VERDICT_TONES: Record<Verdict, StampTone> = {
  GAIN: 'green',
  EVEN: 'amber',
  LOSS: 'red',
  NONE: 'neutral',
};

/** `"-40.00"` → `"-$40.00"`; el signo va antes del símbolo. */
export function signedMoney(amount: string): string {
  return formatCents(moneyToCents(amount));
}

export function isNegative(amount: string): boolean {
  return moneyToCents(amount) < 0;
}

/** `0.456` → `"46 %"`. */
export function percentLabel(fraction: number): string {
  return `${Math.round(fraction * 100)} %`;
}

/** Inversión recuperada: «Faltan datos», «Ya se pagó solo» o el porcentaje. */
export function recoveredLabel(lifetime: Pick<VehicleLifetime, 'recovered'>): string {
  if (lifetime.recovered === null) return 'Faltan datos';
  if (lifetime.recovered >= 1) return 'Ya se pagó solo';
  return `${Math.max(0, Math.round(lifetime.recovered * 100))} %`;
}

export const PROFITABILITY_PRESETS = [
  { key: 'month', label: 'Este mes' },
  { key: 'lastMonth', label: 'Mes pasado' },
  { key: 'quarter', label: 'Últimos 3 meses' },
  { key: 'year', label: 'Este año' },
] as const;
export type ProfitabilityPreset = (typeof PROFITABILITY_PRESETS)[number]['key'];

function lastOfMonth(civil: CivilDate): CivilDate {
  const [year = 0, month = 1] = civil.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

/** «Este mes» corta hoy (110). Los otros presets siguen siendo meses enteros. */
export function profitabilityRange(preset: ProfitabilityPreset, today: CivilDate): CivilRange {
  const month = firstOfMonth(today);

  if (preset === 'lastMonth') {
    const previous = addMonths(month, -1);
    return { from: previous, to: lastOfMonth(previous) };
  }
  if (preset === 'quarter') return { from: addMonths(month, -2), to: lastOfMonth(today) };
  if (preset === 'year')
    return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
  return monthThroughToday(today);
}

/** «Se fue»: gastos del carro más seguro, GPS y cuota. */
export function spentOf(row: { expenses: string; fixed: string; installment: string }): string {
  return centsToMoney(
    moneyToCents(row.expenses) + moneyToCents(row.fixed) + moneyToCents(row.installment),
  );
}

export function matchingProfitabilityPreset(
  range: CivilRange,
  today: CivilDate,
): ProfitabilityPreset | null {
  const match = PROFITABILITY_PRESETS.find((preset) => {
    const value = profitabilityRange(preset.key, today);
    return value.from === range.from && value.to === range.to;
  });

  return match?.key ?? null;
}

const MONTH_SHORT = [
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
];
const MONTH_LONG = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/** `"2026-10"` → `"oct"`. */
export function monthShort(month: string): string {
  return MONTH_SHORT[Number(month.slice(5, 7)) - 1] ?? month;
}

/** `"2026-10"` → `"Octubre"`. */
export function monthName(month: string): string {
  return MONTH_LONG[Number(month.slice(5, 7)) - 1] ?? month;
}

/** `"2026-10"` → `"Octubre 2026"`. */
export function monthLong(month: string): string {
  return `${monthName(month)} ${month.slice(0, 4)}`;
}

/** `1` → `"1 día rentado"`; `1.5` y el resto, en plural. */
export function rentedDaysLabel(days: number): string {
  if (days === 1) return '1 día rentado';

  const shown = Number.isInteger(days) ? String(days) : days.toFixed(1);

  return `${shown} días rentados`;
}

/**
 * El mes en curso corta hoy (110): `"2026-10"` con hoy `2026-10-11` →
 * `"hasta el 11 de octubre"`. Cualquier otro mes, `null`.
 */
export function monthCutoffLabel(month: string, today: CivilDate): string | null {
  if (month !== today.slice(0, 7)) return null;

  const day = Number(today.slice(8, 10));

  return `hasta el ${day} de ${monthName(month).toLowerCase()}`;
}

/**
 * La línea bajo el nombre del mes: días rentados y, si es el mes en curso,
 * hasta qué día cuenta. Un mes futuro o sin uso no la lleva.
 */
export function monthDetailLine(
  row: Pick<VehicleMonthRow, 'month' | 'rentedDays' | 'future' | 'verdict'>,
  today: CivilDate,
): string | null {
  if (row.future || row.verdict === 'NONE') return null;

  const bits: string[] = [];

  if (row.rentedDays > 0) bits.push(rentedDaysLabel(row.rentedDays));

  const cutoff = monthCutoffLabel(row.month, today);

  if (cutoff !== null) bits.push(cutoff);

  return bits.length === 0 ? null : bits.join(' · ');
}

export interface MonthBar {
  month: string;
  /** Centavos del neto. */
  value: number;
  /** Fracción de la escala, con signo: de −1 a 1. */
  ratio: number;
  future: boolean;
}

export interface MonthBarsScale {
  bars: MonthBar[];
  /** El alto total de la escala en centavos: arriba más abajo del cero, con 8 % de aire. */
  top: number;
  /** Qué parte del alto queda arriba del cero: 1 sin pérdidas, 0 sin ganancias. */
  upShare: number;
}

/**
 * La escala de la gráfica de 12 meses: una sola serie («lo que quedó») desde
 * el cero, con un 8 % de aire sobre cada extremo (patrón 067). Si hay
 * pérdidas, el cero sube lo justo para que quepan abajo.
 */
export function monthBarsScale(rows: readonly VehicleMonthRow[]): MonthBarsScale {
  const values = rows.map((row) => moneyToCents(row.net));
  const up = Math.max(0, ...values) * 1.08;
  const down = -Math.min(0, ...values) * 1.08;
  const total = up + down;
  const top = total > 0 ? total : 1;

  return {
    bars: rows.map((row, index) => ({
      month: row.month,
      value: values[index] ?? 0,
      ratio: (values[index] ?? 0) / top,
      future: row.future,
    })),
    top,
    upShare: total > 0 ? up / total : 1,
  };
}
