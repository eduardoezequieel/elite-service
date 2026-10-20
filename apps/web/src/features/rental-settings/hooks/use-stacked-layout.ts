'use client';

import { useSyncExternalStore } from 'react';

import { useDensity } from '@/components/density-provider';

/** El corte `xl` de `globals.css`: debajo, la vista previa y el editor van apilados. */
const WIDE_QUERY = '(min-width: 1180px)';

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(WIDE_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

/**
 * Ajustes (120) en una columna: bahía, o un ancho menor que `xl` (tablet).
 * El servidor no conoce el ancho y pinta la versión de escritorio.
 */
export function useStackedLayout(): boolean {
  const { density } = useDensity();
  const wide = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => true,
  );

  return density === 'bahia' || !wide;
}
