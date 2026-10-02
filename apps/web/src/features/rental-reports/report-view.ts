import { moneyToCents, rentalWhenLabel } from '@elite/shared';
import type {
  DashboardAgreementRef,
  FleetBoardState,
  FleetBoardTile,
  VehicleLifetime,
  VehicleMonthRow,
  Verdict,
} from '@elite/shared';

import type { StampTone } from '@/components/ui/stamp';
import { addMonths, firstOfMonth, type CivilDate, type CivilRange } from '@/lib/civil-date';
import { formatCents } from '@/lib/money';

/** Solo presentación del inicio y la rentabilidad (100): los números llegan hechos. */

export const BOARD_STATE_TONES: Record<FleetBoardState, StampTone> = {
  FREE: 'green',
  OUT: 'amber',
  LATE: 'red',
  BOOKED: 'paid',
  IN_SHOP: 'neutral',
};

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

/** El primer nombre y el primer apellido: «Ana López». */
export function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return parts.join(' ');
  if (parts.length === 3) return `${parts[0]} ${parts[1]}`;
  return `${parts[0]} ${parts[2]}`;
}

/** Quién tiene el carro y cuándo regresa, o cuándo sale (`VIEWS.inicio`). */
export function boardTileLine(tile: Pick<FleetBoardTile, 'state' | 'agreement'>): string {
  const agreement: DashboardAgreementRef | null = tile.agreement;

  if (tile.state === 'IN_SHOP') return 'Fuera de servicio por mantenimiento';
  if (agreement === null) return 'Listo para rentar';

  const name = shortName(agreement.customerName);

  if (tile.state === 'OUT')
    return `Con ${name}, regresa ${rentalWhenLabel(agreement.plannedReturnAt)}`;
  if (tile.state === 'LATE') {
    return `Con ${name}, debía regresar ${rentalWhenLabel(agreement.plannedReturnAt)}`;
  }
  if (tile.state === 'BOOKED')
    return `Sale ${rentalWhenLabel(agreement.plannedPickupAt)} con ${name}`;
  return `Libre hasta ${rentalWhenLabel(agreement.plannedPickupAt)}`;
}

/** Saludo según la hora del taller. */
export function greeting(hour: number): string {
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
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

/** Los presets del prototipo: meses enteros, también el que va corriendo. */
export function profitabilityRange(preset: ProfitabilityPreset, today: CivilDate): CivilRange {
  const month = firstOfMonth(today);

  if (preset === 'lastMonth') {
    const previous = addMonths(month, -1);
    return { from: previous, to: lastOfMonth(previous) };
  }
  if (preset === 'quarter') return { from: addMonths(month, -2), to: lastOfMonth(today) };
  if (preset === 'year')
    return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
  return { from: month, to: lastOfMonth(today) };
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

/** `"2026-10"` → `"Octubre 2026"`. */
export function monthLong(month: string): string {
  return `${MONTH_LONG[Number(month.slice(5, 7)) - 1] ?? month} ${month.slice(0, 4)}`;
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
