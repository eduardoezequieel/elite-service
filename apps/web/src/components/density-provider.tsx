'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * Las dos densidades del sistema (ver DESIGN.md → Layout).
 *
 * - `mostrador`: recepción, teclado y monitor. Fila 36px, control 40px.
 * - `bahia`: tablet, de pie, con guantes. Fila 56px, control 48px.
 *
 * Cambia la densidad, nunca el vocabulario: `globals.css` reescribe los tokens
 * `--row-h`, `--control-h`, `--touch-min`, `--plate-pad`, `--icon-size` y
 * `--field-*` a partir del atributo `data-density` del `<html>`.
 */
export type Density = 'mostrador' | 'bahia';

/** Lo que el usuario puede elegir: una densidad fija, o dejar que la resuelva el dispositivo. */
export type DensityPreference = Density | 'auto';

/** De dónde sale la densidad vigente. */
export type DensityMode = 'auto' | 'manual';

export interface DensityContextValue {
  /** La densidad efectiva, ya resuelta. */
  density: Density;
  /** `auto` si la decide el dispositivo, `manual` si el usuario la fijó. */
  mode: DensityMode;
  /** Fija la densidad a mano, o devuelve el control al dispositivo con `'auto'`. */
  setDensity: (preference: DensityPreference) => void;
}

const STORAGE_KEY = 'elite-density';

/**
 * Bajo 900px el riel se muda al pie y las listas se apilan en tarjetas: es
 * territorio de bahía. El corte coincide con `--breakpoint-md` de `globals.css`
 * para que la densidad y la maquetación cambien en el mismo píxel.
 */
const COMPACT_VIEWPORT_QUERY = '(max-width: 899.98px)';

/** Puntero grueso = dedo con guante: objetivos de 44px. */
const COARSE_POINTER_QUERY = '(pointer: coarse)';

/**
 * El servidor no conoce el viewport ni el puntero, así que renderiza `mostrador`,
 * el mismo valor que el layout escribe en `<html data-density>`. La densidad real
 * se resuelve en el primer efecto, ya en el cliente.
 */
const SERVER_DENSITY: Density = 'mostrador';

const DensityContext = createContext<DensityContextValue | null>(null);

function isDensity(value: unknown): value is Density {
  return value === 'mostrador' || value === 'bahia';
}

/** Lee la preferencia guardada. Solo se llama dentro de un efecto. */
function readStoredPreference(): DensityPreference {
  try {
    const stored: string | null = window.localStorage.getItem(STORAGE_KEY);
    return isDensity(stored) ? stored : 'auto';
  } catch {
    // localStorage puede estar bloqueado (modo privado, cookies de terceros).
    return 'auto';
  }
}

/**
 * Resuelve la densidad y la escribe en `<html data-density>`.
 *
 * No renderiza ningún elemento propio: solo contexto y el efecto que toca el
 * atributo. Cualquier envoltorio rompería la maquetación de las pantallas.
 */
export function DensityProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<DensityPreference>('auto');
  const [automatic, setAutomatic] = useState<Density>(SERVER_DENSITY);

  // Preferencia manual guardada. Va en su propio efecto para que el primer render
  // del cliente coincida con el HTML del servidor.
  useEffect(() => {
    setPreference(readStoredPreference());
  }, []);

  // Regla automática: bahía si el viewport es angosto o el puntero es grueso.
  // Escuchamos las dos consultas y actualizamos en vivo (rotar la tablet, acoplarla).
  useEffect(() => {
    const compactViewport = window.matchMedia(COMPACT_VIEWPORT_QUERY);
    const coarsePointer = window.matchMedia(COARSE_POINTER_QUERY);

    const resolve = () => {
      setAutomatic(compactViewport.matches || coarsePointer.matches ? 'bahia' : 'mostrador');
    };

    resolve();
    compactViewport.addEventListener('change', resolve);
    coarsePointer.addEventListener('change', resolve);

    return () => {
      compactViewport.removeEventListener('change', resolve);
      coarsePointer.removeEventListener('change', resolve);
    };
  }, []);

  // Lo que el usuario fijó a mano manda sobre lo que dice el dispositivo.
  const density: Density = preference === 'auto' ? automatic : preference;

  useEffect(() => {
    document.documentElement.dataset.density = density;
  }, [density]);

  const setDensity = useCallback((next: DensityPreference) => {
    setPreference(next);

    try {
      if (next === 'auto') {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, next);
      }
    } catch {
      // Sin almacenamiento la preferencia vive solo en esta sesión.
    }
  }, []);

  const value = useMemo<DensityContextValue>(
    () => ({
      density,
      mode: preference === 'auto' ? 'auto' : 'manual',
      setDensity,
    }),
    [density, preference, setDensity],
  );

  return <DensityContext.Provider value={value}>{children}</DensityContext.Provider>;
}

/** Densidad vigente, de dónde sale y cómo cambiarla. */
export function useDensity(): DensityContextValue {
  const context = useContext(DensityContext);

  if (context === null) {
    throw new Error('useDensity must be used inside a <DensityProvider>.');
  }

  return context;
}
