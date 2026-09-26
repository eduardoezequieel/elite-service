/**
 * El día civil del taller como instantes (065, reporte de movimientos).
 *
 * `new Date('YYYY-MM-DDT00:00:00')` usaría la zona del proceso, que en Render
 * es UTC: un despacho de las 7 de la noche caería en el día siguiente.
 */

/** La zona del taller. El Salvador no tiene horario de verano. */
export const BUSINESS_TIME_ZONE = 'America/El_Salvador';

/** `[start, end)` del día `YYYY-MM-DD` en la zona del taller. */
export function businessDayBounds(civilDate: string): { start: Date; end: Date } {
  return {
    start: startOfDay(civilDate),
    end: startOfDay(nextCivilDay(civilDate)),
  };
}

function startOfDay(civilDate: string): Date {
  return new Date(`${civilDate}T00:00:00.000${offsetOf(civilDate)}`);
}

function nextCivilDay(civilDate: string): string {
  const [year, month, day] = civilDate.split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

/** Offset de la zona ese día (`±HH:mm`). */
function offsetOf(civilDate: string): string {
  // Mediodía UTC cae el mismo día civil en El Salvador (UTC−6).
  const probe = new Date(`${civilDate}T12:00:00.000Z`);
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    timeZoneName: 'longOffset',
  })
    .formatToParts(probe)
    .find((part) => part.type === 'timeZoneName')?.value;

  const match = /GMT([+-]\d{2}:\d{2})/.exec(name ?? '');

  return match?.[1] ?? '-06:00';
}
