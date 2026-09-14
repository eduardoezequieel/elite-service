'use client';

import type { CarwashStreamMessage } from '@elite/shared';

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
}

/**
 * Abre el stream y devuelve como cerrarlo.
 *
 * La reconexion la hace `EventSource` solo, con su propio respaldo: no se
 * reimplementa aca. Lo unico que se agrega es contarlo hacia afuera, porque de
 * eso depende que vuelva el refresco periodico mientras no hay hilo.
 */
export function openStream(path: string, handlers: StreamHandlers): () => void {
  // `EventSource` no existe durante el render del servidor.
  if (typeof globalThis.EventSource === 'undefined') return () => {};

  const url = `${API_BASE_URL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  const source = new globalThis.EventSource(url, { withCredentials: true });

  handlers.onStatus?.('connecting');

  source.addEventListener('open', () => handlers.onStatus?.('live'));

  source.addEventListener('message', (event: MessageEvent<string>) => {
    let message: CarwashStreamMessage;

    try {
      message = JSON.parse(event.data) as CarwashStreamMessage;
    } catch {
      // Una trama rota no puede tumbar el hilo: se ignora y se sigue.
      return;
    }

    handlers.onMessage(message);
  });

  source.addEventListener('error', () => {
    // `EventSource` reintenta solo mientras no este cerrado. Un error con
    // `CLOSED` si es definitivo: pasa cuando el servidor responde 401, y ahi el
    // respaldo periodico tiene que volver.
    handlers.onStatus?.(source.readyState === source.CLOSED ? 'offline' : 'connecting');
  });

  return () => {
    source.close();
    handlers.onStatus?.('offline');
  };
}
