import type { ComboStatus } from '@elite/shared';

/**
 * Vigencia de un combo (104 RN-3). Reglas puras: el día civil de hoy
 * (`YYYY-MM-DD` en `America/El_Salvador`) lo pone quien llama, nunca el reloj
 * del proceso, que en un servidor en UTC ya es mañana desde las 6 de la tarde.
 */

/** Lo que mira la vigencia. Fechas civiles `YYYY-MM-DD`; `validTo` null = sin fin. */
export interface ComboWindow {
  isActive: boolean;
  validFrom: string;
  validTo: string | null;
  /** 0 = domingo … 6 = sábado. */
  weekdays: readonly number[];
}

/**
 * Estado derivado (RN-3): `PAUSED` si está inactivo; si no `SCHEDULED` antes de
 * `validFrom`, `EXPIRED` después de `validTo` y `LIVE` en el medio. Las fechas
 * `YYYY-MM-DD` se comparan como texto: el orden del texto es el del calendario.
 */
export function comboStatus(combo: Omit<ComboWindow, 'weekdays'>, today: string): ComboStatus {
  if (!combo.isActive) return 'PAUSED';
  if (today < combo.validFrom) return 'SCHEDULED';
  if (combo.validTo !== null && today > combo.validTo) return 'EXPIRED';

  return 'LIVE';
}

/**
 * Día de la semana de una fecha civil, 0 = domingo. Se calcula en UTC sobre la
 * fecha misma: la zona del servidor no puede correrla un día.
 */
export function weekdayOf(civilDate: string): number {
  const [year, month, day] = civilDate.split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** «Disponible hoy» (RN-3): `LIVE` y el día de la semana de hoy está en `weekdays`. */
export function isAvailableOn(combo: ComboWindow, today: string): boolean {
  return comboStatus(combo, today) === 'LIVE' && combo.weekdays.includes(weekdayOf(today));
}
