import { addDays, type CivilDate } from '@/lib/civil-date';

/**
 * Fecha y hora de una renta (096): el campo `datetime-local` ⇄ el instante ISO
 * del contrato.
 *
 * El campo se lee siempre en la hora del taller, no en la del navegador: El
 * Salvador está fijo en UTC−6 (sin horario de verano), así que la cuenta es
 * pura y da lo mismo en una tablet configurada en otra zona.
 */

/** Desfase de El Salvador respecto de UTC. */
const OFFSET = '-06:00';
const OFFSET_MS = -6 * 60 * 60 * 1000;

const FIELD_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** `"2026-10-12T10:00"` (hora del taller) → ISO, o `null` si el campo está vacío o roto. */
export function fieldToInstant(value: string): string | null {
  const trimmed = value.trim();
  if (!FIELD_RE.test(trimmed)) return null;

  const time = Date.parse(`${trimmed}:00${OFFSET}`);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

/** Un instante ISO → el valor del campo en la hora del taller. */
export function instantToField(iso: string | null | undefined): string {
  if (iso === null || iso === undefined || iso === '') return '';
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '';

  return new Date(time + OFFSET_MS).toISOString().slice(0, 16);
}

/** El día civil de un instante, en la hora del taller. */
export function instantToCivil(iso: string | Date): CivilDate {
  const time = iso instanceof Date ? iso.getTime() : Date.parse(iso);
  return new Date(time + OFFSET_MS).toISOString().slice(0, 10);
}

/** Un día a una hora: `("2026-10-12", "10:00")` → `"2026-10-12T10:00"`. */
export function civilAtTime(civil: CivilDate, time: string): string {
  return `${civil}T${time}`;
}

/** El instante en que empieza un día civil del taller. */
export function civilStartInstant(civil: CivilDate): string {
  return new Date(Date.parse(`${civil}T00:00:00${OFFSET}`)).toISOString();
}

/** El campo `days` días después, a la misma hora. */
export function addDaysToField(field: string, days: number): string {
  const match = FIELD_RE.exec(field);
  if (match === null) return field;

  return `${addDays(field.slice(0, 10), days)}${field.slice(10)}`;
}

/** Ahora, redondeado al cuarto de hora siguiente, como valor de campo. */
export function nowField(now: Date = new Date()): string {
  const quarter = 15 * 60 * 1000;
  const rounded = Math.ceil(now.getTime() / quarter) * quarter;

  return instantToField(new Date(rounded).toISOString());
}
