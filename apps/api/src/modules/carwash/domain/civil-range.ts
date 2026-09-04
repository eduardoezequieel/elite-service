import { BUSINESS_TIME_ZONE } from './commission';

/**
 * Rango `[from, to]` civil (`YYYY-MM-DD`) como `[gte, lt)` en la zona del
 * taller. `new Date('YYYY-MM-DDT00:00:00')` usaria la zona del proceso.
 */
export function civilRange(from: string, to: string): { gte: Date; lt: Date } {
  return {
    gte: startOfBusinessDay(from),
    lt: startOfBusinessDay(nextCivilDay(to)),
  };
}

function startOfBusinessDay(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000${offsetOf(isoDate)}`);
}

function nextCivilDay(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

/** Offset de `BUSINESS_TIME_ZONE` ese dia (`±HH:mm`). El Salvador no tiene DST. */
function offsetOf(isoDate: string): string {
  // Mediodia UTC cae el mismo dia civil en SV (UTC−6).
  const probe = new Date(`${isoDate}T12:00:00.000Z`);
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    timeZoneName: 'longOffset',
  })
    .formatToParts(probe)
    .find((part) => part.type === 'timeZoneName')?.value;

  const match = /GMT([+-]\d{2}:\d{2})/.exec(name ?? '');

  return match?.[1] ?? '-06:00';
}
