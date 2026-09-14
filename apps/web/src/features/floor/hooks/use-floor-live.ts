'use client';

import { createContext, useContext } from 'react';

import type { StreamStatus } from '@/lib/realtime';

/**
 * En qué anda el hilo de pista (spec 042). Igual que el de oficina, en su
 * propio archivo para que `use-floor.ts` lo consulte sin cerrar un ciclo con el
 * proveedor.
 */
export const FloorLiveContext = createContext<StreamStatus>('offline');

export function useFloorLive(): { status: StreamStatus; isLive: boolean } {
  const status = useContext(FloorLiveContext);

  return { status, isLive: status === 'live' };
}
