/**
 * Duraciones en español corto, para la línea de tiempo (046).
 *
 * Mismo vocabulario que `waitLabel`: minutos sueltos hasta la hora y `1 h 04
 * min` de ahí en adelante. Los segundos solo aparecen donde hay un contador
 * corriendo; en un tramo ya cerrado serían precisión que a nadie le sirve.
 */

/** Un tramo terminado: `45 s`, `12 min`, `1 h 04 min`. */
export function durationLabel(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));

  if (safe < 60) return `${safe} s`;

  const minutes = Math.floor(safe / 60);

  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);

  return `${hours} h ${String(minutes % 60).padStart(2, '0')} min`;
}

/** El tramo en curso: igual, pero con los segundos que avanzan. */
export function liveDurationLabel(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));

  if (safe < 60 || safe >= 3600) return durationLabel(safe);

  return `${Math.floor(safe / 60)} min ${String(safe % 60).padStart(2, '0')} s`;
}

/** Segundos transcurridos entre un ISO y una marca de reloj. */
export function secondsSince(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
}
