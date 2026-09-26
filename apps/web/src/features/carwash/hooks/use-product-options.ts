'use client';

import type { InventoryItemOption } from '@elite/shared';
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { ApiError } from '@/lib/api';

/**
 * Los productos del bloque «Productos» del lavado (065).
 *
 * Quien llama pasa su propia búsqueda —oficina pega a `/carwash/*`, la pista a
 * `/floor/*`— y el `scope` encabeza la clave. En oficina eso la cuelga de
 * `['carwash']`, así que cualquier evento del hilo la invalida junto con los
 * lavados: la existencia se mueve cada vez que alguien agrega un producto, y
 * un «Hay 3» viejo es justo el que termina en `409 INSUFFICIENT_STOCK`.
 */
export function useProductOptions(
  scope: string,
  searchProducts: (search: string) => Promise<InventoryItemOption[]>,
  search: string,
  enabled = true,
): UseQueryResult<InventoryItemOption[], ApiError> {
  const term = search.trim();

  return useQuery<InventoryItemOption[], ApiError>({
    queryKey: [scope, 'inventory-items', term],
    queryFn: () => searchProducts(term),
    enabled,
    staleTime: 0,
    // Mientras llega la búsqueda nueva se queda la anterior: la lista no
    // parpadea a vacío con cada tecla.
    placeholderData: keepPreviousData,
  });
}
