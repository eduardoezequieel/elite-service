import type { WorkOrderStatus } from '@elite/shared';

/** Cuánto se queda a la vista la marca antes de empezar a irse (063). */
export const SPLASH_VISIBLE_MS = 1200;

/** Lo que dura el fundido de salida: `--duration-state`. */
export const SPLASH_LEAVE_MS = 140;

export interface SplashEntry {
  /** Cambia con cada marca: la vista lo usa de `key` para reiniciar la animación. */
  id: number;
  status: WorkOrderStatus;
  /** `#número · placa`. */
  caption: string;
  leaving: boolean;
}

/**
 * El tiempo de vida de la marca de estado, sin React para poder probarlo.
 *
 * Una sola a la vez: la nueva reemplaza a la anterior y reinicia el reloj.
 */
export function createSplashController(onChange: (entry: SplashEntry | null) => void) {
  let nextId = 0;
  let current: SplashEntry | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clear = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const emit = (entry: SplashEntry | null) => {
    current = entry;
    onChange(entry);
  };

  return {
    show(status: WorkOrderStatus, caption: string) {
      clear();
      nextId += 1;
      emit({ id: nextId, status, caption, leaving: false });

      timer = setTimeout(() => {
        if (current !== null) emit({ ...current, leaving: true });

        timer = setTimeout(() => {
          timer = null;
          emit(null);
        }, SPLASH_LEAVE_MS);
      }, SPLASH_VISIBLE_MS);
    },
    dispose: clear,
  };
}
