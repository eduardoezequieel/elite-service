'use client';

import { createContext, useContext } from 'react';

import type { StreamStatus } from '@/lib/realtime';

/**
 * En qué anda el hilo de lavados (spec 042).
 *
 * Está en su propio archivo, sin lógica, para que `use-tickets.ts` pueda
 * preguntarlo sin importar al proveedor —que a su vez importa las claves de
 * `use-tickets.ts`— y no quede un ciclo entre los dos.
 */
export const CarwashLiveContext = createContext<StreamStatus>('offline');

export interface CarwashLive {
  status: StreamStatus;
  /**
   * Con el hilo vivo el refresco periódico sobra. Sin él, vuelve: el respaldo
   * de la spec 019 se queda puesto justamente para esto.
   */
  isLive: boolean;
}

export function useCarwashLive(): CarwashLive {
  const status = useContext(CarwashLiveContext);

  return { status, isLive: status === 'live' };
}
