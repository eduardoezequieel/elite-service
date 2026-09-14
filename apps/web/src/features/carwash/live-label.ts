/**
 * Qué dice la cabecera sobre de dónde vienen los datos (spec 042).
 *
 * Tres estados y no dos: «en vivo» cuando el servidor empuja, «se actualiza
 * sola» cuando el hilo se cayó y quedó el refresco periódico de respaldo, y
 * «actualizando» mientras la lista está en vuelo. Que la pantalla diga cuál de
 * los tres es no es un adorno: sin eso, una fila quieta se ve igual estando al
 * día que estando desconectada.
 */
export type RefreshState = 'fetching' | 'live' | 'polling';

export function refreshState(isLive: boolean, isFetching: boolean): RefreshState {
  if (isFetching) return 'fetching';

  return isLive ? 'live' : 'polling';
}

/** Oficina lo encadena detrás de la fecha, en minúscula. */
export const OFFICE_REFRESH_LABELS: Record<RefreshState, string> = {
  fetching: ' · actualizando',
  live: ' · en vivo',
  polling: ' · se actualiza sola',
};

/** Pista lo usa solo, como subtítulo entero. */
export const FLOOR_REFRESH_LABELS: Record<RefreshState, string> = {
  fetching: 'Actualizando…',
  live: 'En vivo',
  polling: 'Se actualiza sola',
};
