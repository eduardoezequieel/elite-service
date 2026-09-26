/**
 * Lo que no se puede perder (spec 062).
 *
 * Lavados, caja y pista se piden de nuevo al montar la pantalla, al volver a la
 * ventana y al recuperar red, **aunque la copia sea reciente**. `'always'`
 * ignora `staleTime`: si alguien lo sube en el `QueryClient` o en el hook, esto
 * sigue valiendo. El hilo SSE avisa, pero no es la única garantía.
 */
export const ALWAYS_FRESH = {
  refetchOnMount: 'always',
  refetchOnWindowFocus: 'always',
  refetchOnReconnect: 'always',
} as const;

/**
 * Cada cuánto se pide la lista aunque el hilo diga que está vivo. Un evento
 * perdido sin que la conexión se caiga no dispara `onReconnect`: esto lo cubre.
 */
export const LIVE_SAFETY_POLL_MS = 60_000;

/** Sin hilo, el respaldo de la spec 019. */
export const OFFLINE_POLL_MS = 15_000;

/** El intervalo de una lista en vivo según cómo anda el hilo. */
export function listPollMs(isLive: boolean): number {
  return isLive ? LIVE_SAFETY_POLL_MS : OFFLINE_POLL_MS;
}
