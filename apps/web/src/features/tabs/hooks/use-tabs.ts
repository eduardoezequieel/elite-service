'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { API_ERROR_CODES } from '@elite/shared';
import type {
  AddTabLinesInput,
  PayTabInput,
  TabDetail,
  TabHolderKind,
  TabHolderOption,
  TabHolderOptions,
  TabList,
  TabsQuery,
  VoidTabLineInput,
} from '@elite/shared';

import type { ApiError } from '@/lib/api';
import { ALWAYS_FRESH } from '@/lib/freshness';
import { CASH_QUERY_KEY } from '@/features/carwash/hooks/use-cash';
import { SALES_QUERY_KEY } from '@/features/sales/hooks/use-sales';
import { addTabLines, getTab, listTabHolders, listTabs, payTab, voidTabLine } from '../api';

export const TABS_QUERY_KEY = ['tabs'] as const;

/**
 * La persona elegida en «Abrir cuenta», guardada para que «Nueva venta» la
 * muestre sin volver a buscarla (105). No se pide al API: solo se lee.
 */
export function holderQueryKey(kind: TabHolderKind, id: string) {
  return [...TABS_QUERY_KEY, 'holder', kind, id] as const;
}

/**
 * Anotar, quitar y cobrar mueven la cuenta, la existencia (el producto sale o
 * vuelve), «Ventas del día» (el abono es una fila) y el turno de caja. Todo por
 * prefijo, y la cuenta que volvió del API queda puesta en su detalle.
 */
function useTabSideEffects() {
  const queryClient = useQueryClient();

  return (tab: TabDetail) => {
    queryClient.setQueryData([...TABS_QUERY_KEY, 'detail', tab.id], tab);
    void queryClient.invalidateQueries({ queryKey: TABS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: SALES_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    void queryClient.invalidateQueries({ queryKey: CASH_QUERY_KEY });
  };
}

export function useTabs(
  params: Partial<TabsQuery>,
  enabled = true,
): UseQueryResult<TabList, ApiError> {
  return useQuery<TabList, ApiError>({
    queryKey: [...TABS_QUERY_KEY, 'list', params],
    queryFn: () => listTabs(params),
    enabled,
    placeholderData: keepPreviousData,
    ...ALWAYS_FRESH,
  });
}

/** Solo los totales: el contador de la pestaña «Cuentas abiertas». */
export function useTabsSummary(enabled = true): UseQueryResult<TabList, ApiError> {
  return useTabs({ pageSize: 1 }, enabled);
}

export function useTab(id: string | null): UseQueryResult<TabDetail, ApiError> {
  return useQuery<TabDetail, ApiError>({
    queryKey: [...TABS_QUERY_KEY, 'detail', id],
    queryFn: () => getTab(id ?? ''),
    enabled: id !== null,
    ...ALWAYS_FRESH,
  });
}

/** El selector de titular: empleados activos y clientes, con su cuenta abierta. */
export function useTabHolders(
  search: string,
  enabled = true,
): UseQueryResult<TabHolderOptions, ApiError> {
  return useQuery<TabHolderOptions, ApiError>({
    queryKey: [...TABS_QUERY_KEY, 'holders', search],
    queryFn: () => listTabHolders(search),
    enabled,
    placeholderData: keepPreviousData,
    ...ALWAYS_FRESH,
  });
}

/** La persona que dejó guardada «Abrir cuenta», si sigue en la caché. */
export function usePrimedHolder(
  kind: TabHolderKind | null,
  id: string | null,
): TabHolderOption | null {
  const queryClient = useQueryClient();

  if (kind === null || id === null) return null;

  return queryClient.getQueryData<TabHolderOption>(holderQueryKey(kind, id)) ?? null;
}

export function useAddTabLines() {
  const settle = useTabSideEffects();
  const queryClient = useQueryClient();

  return useMutation<TabDetail, ApiError, AddTabLinesInput>({
    mutationFn: addTabLines,
    onSuccess: settle,
    // Todo o nada: si no alcanzó un producto, el buscador vuelve a decir cuánto hay.
    onError: () => void queryClient.invalidateQueries({ queryKey: SALES_QUERY_KEY }),
  });
}

export function useVoidTabLine(tabId: string) {
  const settle = useTabSideEffects();

  return useMutation<TabDetail, ApiError, { lineId: string; input: VoidTabLineInput }>({
    mutationFn: ({ lineId, input }) => voidTabLine(tabId, lineId, input),
    onSuccess: settle,
  });
}

export function usePayTab(tabId: string) {
  const settle = useTabSideEffects();
  const queryClient = useQueryClient();

  return useMutation<TabDetail, ApiError, PayTabInput>({
    mutationFn: (input) => payTab(tabId, input),
    onSuccess: settle,
    onError: (error) => {
      // La cuenta bancaria se desactivó mientras se cobraba (069).
      if (error.code === API_ERROR_CODES.BANK_ACCOUNT_UNAVAILABLE) {
        void queryClient.invalidateQueries({ queryKey: ['banking'] });
      }
    },
  });
}
