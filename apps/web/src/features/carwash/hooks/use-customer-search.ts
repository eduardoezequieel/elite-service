'use client';

import { useQuery } from '@tanstack/react-query';
import type { Customer } from '@elite/shared';

import type { ApiError } from '@/lib/api';
import { useDebouncedValue } from '@/lib/use-debounced-value';

/** Desde cuántos caracteres se empieza a sugerir (004 RN-3). */
export const SUGGESTION_MIN_LENGTH = 2;

/** Cuántas sugerencias como mucho: una lista larga no se toca, se lee (RN-3). */
export const SUGGESTION_LIMIT = 6;

export interface CustomerSearch {
  /** Las sugerencias, ya recortadas al máximo. */
  suggestions: Customer[];
  /** `true` mientras el texto es demasiado corto para buscar. */
  tooShort: boolean;
  isPending: boolean;
  error: ApiError | null;
}

/**
 * Las sugerencias de clientes mientras se escribe (RN-3).
 *
 * El texto se busca **250 ms después de la última tecla** y desde 2 caracteres:
 * el mismo campo sirve para el nombre y para el teléfono, y el filtrado por uno
 * u otro lo hace el API.
 *
 * `scope` separa la caché de la pista de la de oficina: son dos rutas distintas
 * (`/floor/customers` y `/customers`) con dos sesiones distintas, y una no debe
 * servirle la respuesta a la otra.
 */
export function useCustomerSearch(
  scope: string,
  term: string,
  search: (query: string) => Promise<Customer[]>,
  enabled = true,
): CustomerSearch {
  const debounced = useDebouncedValue(term.trim());
  const tooShort = debounced.length < SUGGESTION_MIN_LENGTH;
  const active = enabled && !tooShort;

  const query = useQuery<Customer[], ApiError>({
    queryKey: ['customer-search', scope, debounced],
    queryFn: () => search(debounced),
    enabled: active,
  });

  return {
    suggestions: active ? (query.data ?? []).slice(0, SUGGESTION_LIMIT) : [],
    tooShort,
    isPending: active && query.isPending,
    error: active ? query.error : null,
  };
}
