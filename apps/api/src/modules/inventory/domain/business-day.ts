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

/**
 * `[start, end)` del mes civil `YYYY-MM` en la zona del taller (070 RN-5): del
 * primer día a las 00:00 al primero del mes siguiente a las 00:00.
 */
export function businessMonthBounds(month: string): { start: Date; end: Date } {
  const [year, monthNumber] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 7);

  return {
    start: startOfDay(`${month}-01`),
    end: startOfDay(`${next}-01`),
  };
}

/** El mes civil `YYYY-MM` de un instante en la zona del taller. */
export function businessMonthOf(instant: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(instant);
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';

  return `${year}-${month}`;
}
