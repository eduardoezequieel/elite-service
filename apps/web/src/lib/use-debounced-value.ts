'use client';

import { useEffect, useState } from 'react';

/** El respiro entre la última tecla y la búsqueda (004 RN-3). */
export const SEARCH_DEBOUNCE_MS = 250;

/**
 * El mismo valor, pero un momento después de que dejó de cambiar.
 *
 * Se usa para no pedirle al servidor una lista por cada tecla: quien escribe
 * «Juan» no quiere cuatro búsquedas, quiere una. El valor que se muestra en el
 * campo sigue siendo el inmediato; lo que espera es la consulta.
 */
export function useDebouncedValue<Value>(value: Value, delay = SEARCH_DEBOUNCE_MS): Value {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = globalThis.setTimeout(() => setSettled(value), delay);

    return () => globalThis.clearTimeout(timer);
  }, [value, delay]);

  return settled;
}
