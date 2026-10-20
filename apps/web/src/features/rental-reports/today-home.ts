import { fleetVehicleName } from '@elite/shared';
import type { FleetAlert, TodayOutRow, TodayRow } from '@elite/shared';

import { civilStartInstant } from '@/features/rentals/datetime';
import { addDays, parseCivil, type CivilDate } from '@/lib/civil-date';

/**
 * Hoy (125): ocupación de la semana, salidas y regresos del día, atrasos y
 * avisos vencidos. El tramo de un día civil es `[00:00, 24:00)` en El Salvador,
 * igual que el calendario (`intervalsClash` con margen 0).
 */

export const HOME_WEEK_DAYS = 7;

const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;

export interface OccupyingSlot {
  vehicleId: string;
  start: string;
  end: string;
}

export interface WeekDayOccupancy {
  date: CivilDate;
  /** «Lun 19». */
  label: string;
  occupied: number;
}

/** `2026-10-19` → `Lun 19`. */
export function weekDayLabel(date: CivilDate): string {
  const name = WEEKDAY_LABELS[parseCivil(date).getUTCDay()] ?? '';

  return `${name} ${Number(date.slice(8, 10))}`;
}

/** Hoy y los seis días que siguen. */
export function weekDates(today: CivilDate): CivilDate[] {
  return Array.from({ length: HOME_WEEK_DAYS }, (_, index) => addDays(today, index));
}

/** El tramo toca el día civil si se cruza con `[00:00, 24:00)`. */
export function slotTouchesCivilDay(
  slot: Pick<OccupyingSlot, 'start' | 'end'>,
  day: CivilDate,
): boolean {
  const start = Date.parse(slot.start);
  const end = Date.parse(slot.end);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;

  const dayStart = Date.parse(civilStartInstant(day));
  const dayEnd = Date.parse(civilStartInstant(addDays(day, 1)));

  return start < dayEnd && dayStart < end;
}

/** Carros distintos con alguna renta que toca el día. */
export function occupiedVehicles(slots: readonly OccupyingSlot[], day: CivilDate): number {
  const ids = new Set<string>();

  for (const slot of slots) {
    if (slotTouchesCivilDay(slot, day)) ids.add(slot.vehicleId);
  }

  return ids.size;
}

export function weekOccupancy(
  slots: readonly OccupyingSlot[],
  today: CivilDate,
): WeekDayOccupancy[] {
  return weekDates(today).map((date) => ({
    date,
    label: weekDayLabel(date),
    occupied: occupiedVehicles(slots, date),
  }));
}

/** Ancho de la barra, de 0 a 1. Sin carros activos, la barra queda vacía. */
export function occupancyRatio(occupied: number, active: number): number {
  if (active <= 0 || occupied <= 0) return 0;

  return Math.min(1, occupied / active);
}

/** Filas del calendario, aplastadas a un tramo por renta. */
export function slotsOf(
  rows: readonly {
    vehicle: { id: string };
    agreements: readonly { start: string; end: string }[];
  }[],
): OccupyingSlot[] {
  return rows.flatMap((row) =>
    row.agreements.map((slot) => ({
      vehicleId: row.vehicle.id,
      start: slot.start,
      end: slot.end,
    })),
  );
}

export type HomeMoveKind = 'deliver' | 'receive';

/** Una salida de hoy o un regreso de hoy, para «Salen y vuelven». */
export interface HomeMove {
  agreementId: string;
  plate: string;
  vehicleName: string;
  customerName: string;
  at: string;
  kind: HomeMoveKind;
}

/** Una renta atrasada, para «Pendientes». */
export interface OverduePending {
  agreementId: string;
  plate: string;
  vehicleName: string;
  customerName: string;
  customerPhone: string;
  at: string;
}

/** Un carro con al menos un aviso `DUE`. */
export interface AlertPending {
  vehicleId: string;
  plate: string;
  vehicleName: string;
  texts: string[];
}

type NamedRow = Pick<TodayRow, 'agreementId' | 'plate' | 'vehicleName' | 'customerName' | 'at'>;

function timeOf(iso: string): number {
  const time = Date.parse(iso);

  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function named(row: NamedRow) {
  return {
    agreementId: row.agreementId,
    plate: row.plate,
    vehicleName: row.vehicleName,
    customerName: row.customerName,
    at: row.at,
  };
}

/**
 * Salidas de hoy y regresos de hoy, por hora. A la misma hora, primero la
 * entrega.
 */
export function homeMoves(today: {
  departures: readonly TodayRow[];
  out: readonly TodayOutRow[];
}): HomeMove[] {
  const moves: HomeMove[] = [
    ...today.departures.map((row) => ({ ...named(row), kind: 'deliver' as const })),
    ...today.out
      .filter((row) => row.returnStatus === 'TODAY')
      .map((row) => ({ ...named(row), kind: 'receive' as const })),
  ];

  return moves.sort(
    (left, right) =>
      timeOf(left.at) - timeOf(right.at) ||
      (left.kind === right.kind ? 0 : left.kind === 'deliver' ? -1 : 1),
  );
}

/** Rentas atrasadas, de la que debió volver antes a la más reciente. */
export function overduePending(out: readonly TodayOutRow[]): OverduePending[] {
  return out
    .filter((row) => row.returnStatus === 'OVERDUE')
    .map((row) => ({ ...named(row), customerPhone: row.customerPhone }))
    .sort((left, right) => timeOf(left.at) - timeOf(right.at));
}

type AlertVehicle = {
  id: string;
  plate: string | null;
  make: string;
  model: string;
  year: number | null;
  alerts: readonly Pick<FleetAlert, 'level' | 'text'>[];
};

/** Carros con avisos vencidos, en el orden en que llegan. */
export function dueAlertPending(vehicles: readonly AlertVehicle[]): AlertPending[] {
  const rows: AlertPending[] = [];

  for (const vehicle of vehicles) {
    const texts = vehicle.alerts
      .filter((alert) => alert.level === 'DUE')
      .map((alert) => alert.text);
    if (texts.length === 0) continue;

    rows.push({
      vehicleId: vehicle.id,
      plate: vehicle.plate ?? '',
      vehicleName: fleetVehicleName(vehicle),
      texts,
    });
  }

  return rows;
}
