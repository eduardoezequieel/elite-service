'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  DEFAULT_PRINT_OPTIONS,
  PRINT_OPTIONS_STORAGE_KEY,
  parsePrintOptions,
  type PrintOptions,
} from '../print-layout';

/**
 * Las opciones de impresión del contrato (097 RN-4): se recuerdan en el
 * `localStorage` de este navegador, nunca en el servidor. Se leen después de
 * montar para que el primer render del servidor y del cliente coincidan.
 */
export function usePrintOptions(): [PrintOptions, (next: PrintOptions) => void] {
  const [options, setOptions] = useState<PrintOptions>(DEFAULT_PRINT_OPTIONS);

  useEffect(() => {
    try {
      setOptions(parsePrintOptions(window.localStorage.getItem(PRINT_OPTIONS_STORAGE_KEY)));
    } catch {
      // Sin acceso al almacenamiento (modo privado, bloqueado): quedan las de fábrica.
    }
  }, []);

  const update = useCallback((next: PrintOptions) => {
    setOptions(next);
    try {
      window.localStorage.setItem(PRINT_OPTIONS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Igual se imprime con lo elegido; solo no se recuerda.
    }
  }, []);

  return [options, update];
}
