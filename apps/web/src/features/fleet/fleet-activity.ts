import type { FleetVehicle } from '@elite/shared';

import { CIVIL_TZ, parseCivil, timeLabel, todayCivil } from '@/lib/civil-date';

/**
 * spec 115, RN-4 — La línea de la tarjeta: qué está pasando con el carro.
 *
 * El API dice qué renta manda y cuándo (`activity`); acá solo se arma la
 * frase. `when` va aparte para resaltarlo: «Vuelve **hoy 5:00 p.m.** · Ana».
 */
export interface FleetActivityLine {
  lead: string;
  when: string;
  customer: string | null;
}

const weekdayFormatter = new Intl.DateTimeFormat('es-SV', { weekday: 'long', timeZone: CIVIL_TZ });
const dayMonthFormatter = new Intl.DateTimeFormat('es-SV', {
  day: 'numeric',
  month: 'short',
  timeZone: CIVIL_TZ,
});

const DAY_MS = 86_400_000;

/** Días civiles (hora del taller) de `now` a `at`: 0 hoy, 1 mañana, -1 ayer. */
function civilDaysBetween(now: Date, at: Date): number {
  return Math.round(
    (parseCivil(todayCivil(at)).getTime() - parseCivil(todayCivil(now)).getTime()) / DAY_MS,
  );
}

function futureWhen(at: Date, days: number): string {
  const iso = at.toISOString();
  if (days === 0) return `hoy ${timeLabel(iso)}`;
  if (days === 1) return `mañana ${timeLabel(iso)}`;
  if (days <= 6) return `el ${weekdayFormatter.format(at)}`;

  return `el ${dayMonthFormatter.format(at).replace(/\./g, '')}`;
}

function pastWhen(at: Date, days: number): string {
  if (days === 0) return `hoy a las ${timeLabel(at.toISOString())}`;
  if (days === -1) return 'ayer';

  return `hace ${-days} días`;
}

export function fleetActivityLine(
  vehicle: Pick<FleetVehicle, 'activity'>,
  now: Date = new Date(),
): FleetActivityLine | null {
  const { activity } = vehicle;

  // Sin renta en camino no hay línea (121): el sello ya dice Libre o Taller.
  if (activity === null) return null;

  const at = new Date(activity.at);
  const days = civilDaysBetween(now, at);
  const past = at.getTime() < now.getTime();
  const lead =
    activity.kind === 'RETURN' ? (past ? 'Debió volver' : 'Vuelve') : past ? 'Debió salir' : 'Sale';

  return {
    lead,
    when: past ? pastWhen(at, days) : futureWhen(at, days),
    customer: activity.customerName,
  };
}
