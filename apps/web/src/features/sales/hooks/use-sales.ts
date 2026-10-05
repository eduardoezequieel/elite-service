'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  CounterSale,
  InventoryItemOption,
  Page,
  SalesFeedEntry,
  SalesFeedQuery,
  VoidCounterSaleInput,
} from '@elite/shared';

import type { ApiError } from '@/lib/api';
import { ALWAYS_FRESH } from '@/lib/freshness';
import { CASH_QUERY_KEY } from '@/features/carwash/hooks/use-cash';
import { TICKETS_QUERY_KEY } from '@/features/carwash/hooks/use-tickets';
import { getSale, listSalesFeed, listSellableItems, voidSale } from '../api';

export const SALES_QUERY_KEY = ['sales'] as const;
const SELLABLE_QUERY_KEY = [...SALES_QUERY_KEY, 'inventory-items'] as const;

/**
 * Anular mueve cuatro cosas a la vez (RN-22, 066): la lista de ventas, el
 * turno de caja, la existencia y los lavados que se cobraron en la misma
 * cuenta, que vuelven a listo. La del inventario va por prefijo, para que el
 * kardex y la lista de `/inventory` también se pongan al día. Vender pasa por
 * `useCreateCharge` del lavado: es la misma cuenta.
 */
function useSaleSideEffects() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: SALES_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: CASH_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    void queryClient.invalidateQueries({ queryKey: TICKETS_QUERY_KEY });
  };
}

/** «Ventas del día» (106): la venta suelta y el abono a una cuenta, en una sola lista. */
export function useSalesFeed(
  params: Partial<SalesFeedQuery>,
): UseQueryResult<Page<SalesFeedEntry>, ApiError> {
  return useQuery<Page<SalesFeedEntry>, ApiError>({
    queryKey: [...SALES_QUERY_KEY, 'feed', params],
    queryFn: () => listSalesFeed(params),
    placeholderData: keepPreviousData,
    ...ALWAYS_FRESH,
  });
}

export function useSale(id: string): UseQueryResult<CounterSale, ApiError> {
  return useQuery<CounterSale, ApiError>({
    queryKey: [...SALES_QUERY_KEY, 'detail', id],
    queryFn: () => getSale(id),
    ...ALWAYS_FRESH,
  });
}

/**
 * Los productos del buscador, con su «Hay N» al día. Se piden siempre frescos:
 * la existencia la mueve cualquier lavado de la pista mientras se arma la venta
 * (RN-18).
 */
export function useSellableItems(
  search: string,
  enabled = true,
): UseQueryResult<InventoryItemOption[], ApiError> {
  return useQuery<InventoryItemOption[], ApiError>({
    queryKey: [...SELLABLE_QUERY_KEY, search],
    queryFn: () => listSellableItems(search),
    enabled,
    placeholderData: keepPreviousData,
    ...ALWAYS_FRESH,
  });
}

export function useVoidSale(id: string) {
  const settle = useSaleSideEffects();

  return useMutation<CounterSale, ApiError, VoidCounterSaleInput>({
    mutationFn: (input) => voidSale(id, input),
    onSuccess: settle,
  });
}
