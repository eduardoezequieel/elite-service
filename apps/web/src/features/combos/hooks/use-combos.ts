'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type { ComboDetail, CreateComboInput, Page, UpdateComboInput } from '@elite/shared';

import { CATALOG_QUERY_KEY } from '@/features/catalog/hooks/use-catalog';
import { CARWASH_QUERY_KEY } from '@/features/carwash/hooks/use-tickets';
import type { ApiError } from '@/lib/api';
import { createCombo, listCombos, updateCombo, type CombosParams } from '../api';

/** Cuelga del catálogo: lo que invalida el catálogo invalida los combos. */
export const COMBOS_QUERY_KEY = [...CATALOG_QUERY_KEY, 'combos'] as const;

/** Una página de Catálogo → Combos. */
export function useCombos(
  params: CombosParams,
  enabled = true,
): UseQueryResult<Page<ComboDetail>, ApiError> {
  return useQuery<Page<ComboDetail>, ApiError>({
    queryKey: [...COMBOS_QUERY_KEY, params],
    queryFn: () => listCombos(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/**
 * Tocar un combo invalida también el lavado: el alta muestra los combos de hoy,
 * y quedarse con la copia vieja ofrecería uno pausado o a otro precio.
 */
function useComboInvalidation() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: COMBOS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: CARWASH_QUERY_KEY });
  };
}

export function useCreateCombo() {
  const invalidate = useComboInvalidation();

  return useMutation<ComboDetail, ApiError, CreateComboInput>({
    mutationFn: createCombo,
    onSuccess: invalidate,
  });
}

export function useUpdateCombo() {
  const invalidate = useComboInvalidation();

  return useMutation<ComboDetail, ApiError, { id: string; input: UpdateComboInput }>({
    mutationFn: ({ id, input }) => updateCombo(id, input),
    onSuccess: invalidate,
  });
}
