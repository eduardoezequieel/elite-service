'use client';

import type { CarwashStreamMessage } from '@elite/shared';
import { STREAM_HEARTBEAT_MS } from '@elite/shared';

import { API_BASE_URL } from './api';

/**
 * El hilo abierto con el API (spec 042).
 *
 * Es SSE, no WebSocket: la web pega al mismo origen que el resto del API
 * —Next reescribe `/api` a Nest—, asi que la cookie httpOnly viaja sola y no
 * hace falta ni exponer la URL del API al navegador ni inventar un ticket de
 * handshake. El porque completo esta en el ADR-012.
 *
 * Esta es la unica peticion de la web que **no** pasa por `apiFetch`: `apiFetch`
 * normaliza una respuesta JSON que termina, y esto no termina. La excepcion esta
 * declarada en `apps/web/AGENTS.md`.
 */

/** En que anda la conexion. Lo que decide si el polling de respaldo corre. */
export type StreamStatus = 'connecting' | 'live' | 'offline';

export interface StreamHandlers {
  onMessage: (message: CarwashStreamMessage) => void;
  onStatus?: (status: StreamStatus) => void;
  /**
   * El hilo volvio a abrirse despues de haber estado abierto. Lo que paso en el
   * hueco no viajo: quien escucha tiene que ponerse al dia por su cuenta.
   */
  onReconnect?: () => void;
}

/**
 * Cuanto silencio se tolera antes de dar el hilo por muerto.
 *
 * El servidor late cada `STREAM_HEARTBEAT_MS`; dos latidos perdidos mas un
 * margen es una conexion que ya no trae nada. Pasa cuando la conexion muere sin
 * despedirse —tapa de la laptop, tablet bloqueada, cambio de wifi, un proxy que
 * corta en silencio—: `EventSource` no se entera, sigue en `OPEN` y no
 * reconecta nunca. Este es el unico lugar que lo detecta.
 */
export const STREAM_STALE_MS = STREAM_HEARTBEAT_MS * 2 + 10_000;

/** Cada cuanto se revisa el silencio. */
const WATCHDOG_INTERVAL_MS = 15_000;

/**
 * Espera antes de volver a intentar cuando `EventSource` se rindio.
 *
 * Ante una respuesta que no es 200 —el 500 del proxy mientras el API arranca
 * tras un deploy, un 401 de sesion vencida— `EventSource` pasa a `CLOSED` y no
 * reintenta jamas: sin esto, el hilo quedaba muerto hasta recargar la pagina.
 * Se reintenta con espera creciente, de 5 s a 1 min, y sin tope de veces.
 */
export const STREAM_RETRY_MIN_MS = 5_000;
export const STREAM_RETRY_MAX_MS = 60_000;

/**
 * Abre el stream y devuelve como cerrarlo.
 *
 * La reconexion tras un error o un cierre la hace `EventSource` solo, con su
 * propio respaldo: no se reimplementa aca. Lo que se agrega es lo que
 * `EventSource` no hace: detectar la conexion muerta en silencio y reabrirla,
 * y contar hacia afuera en que anda, porque de eso depende que vuelva el
 * refresco periodico mientras no hay hilo.
 */
export function openStream(path: string, handlers: StreamHandlers): () => void {
  // `EventSource` no existe durante el render del servidor.
  if (typeof globalThis.EventSource === 'undefined') return () => {};

  const url = `${API_BASE_URL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

  let source: EventSource | null = null;
  let lastMessageAt = Date.now();
  let hadConnection = false;
  let closed = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryDelay = STREAM_RETRY_MIN_MS;

  const isStale = (): boolean => Date.now() - lastMessageAt > STREAM_STALE_MS;

  const cancelRetry = (): void => {
    if (retryTimer === null) return;
    clearTimeout(retryTimer);
    retryTimer = null;
  };

  const scheduleRetry = (): void => {
    if (closed || retryTimer !== null) return;

    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (!closed) connect();
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, STREAM_RETRY_MAX_MS);
  };

  const connect = (): void => {
    cancelRetry();
    source?.close();
    lastMessageAt = Date.now();

    const next = new globalThis.EventSource(url, { withCredentials: true });
    source = next;

    handlers.onStatus?.('connecting');

    next.addEventListener('open', () => {
      lastMessageAt = Date.now();
      retryDelay = STREAM_RETRY_MIN_MS;
      handlers.onStatus?.('live');

      if (hadConnection) handlers.onReconnect?.();
      hadConnection = true;
    });

    next.addEventListener('message', (event: MessageEvent<string>) => {
      // El latido cuenta como señal de vida aunque no se entregue.
      lastMessageAt = Date.now();

      let message: CarwashStreamMessage;

      try {
        message = JSON.parse(event.data) as CarwashStreamMessage;
      } catch {
        // Una trama rota no puede tumbar el hilo: se ignora y se sigue.
        return;
      }

      handlers.onMessage(message);
    });

    next.addEventListener('error', () => {
      if (next !== source) return;

      // Mientras `EventSource` reintenta por su cuenta (`CONNECTING`) no se le
      // pisa el respaldo. `CLOSED` es que se rindio —el servidor respondio algo
      // que no es 200—: vuelve el refresco periodico y se reintenta desde aca.
      if (next.readyState !== next.CLOSED) {
        handlers.onStatus?.('connecting');
        return;
      }

      handlers.onStatus?.('offline');
      scheduleRetry();
    });
  };

  // Lo que `EventSource` no ve: abierto pero mudo.
  const reviveIfSilent = (): void => {
    if (closed || source === null) return;
    if (source.readyState === source.OPEN && isStale()) connect();
  };

  connect();

  const watchdog = setInterval(reviveIfSilent, WATCHDOG_INTERVAL_MS);

  // Al volver a la pestaña o recuperar red no se espera al proximo tick ni a
  // la espera del reintento: si el hilo quedo mudo o rendido, se reabre ya.
  const wake = (): void => {
    if (closed || source === null) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

    if (source.readyState === source.CLOSED) {
      connect();
      return;
    }

    reviveIfSilent();
  };

  const hasDom = typeof document !== 'undefined' && typeof window !== 'undefined';

  if (hasDom) {
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
  }

  return () => {
    closed = true;
    clearInterval(watchdog);
    cancelRetry();

    if (hasDom) {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
    }

    source?.close();
    source = null;
    handlers.onStatus?.('offline');
  };
}
