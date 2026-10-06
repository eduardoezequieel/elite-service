'use client';

import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';
import type {
  ProfitabilityQuery,
  ProfitabilityReport,
  RentalToday,
  VehicleMonths,
} from '@elite/shared';

import type { ApiError } from '@/lib/api';
import { ALWAYS_FRESH } from '@/lib/freshness';
import { getProfitability, getRentalToday, getVehicleMonths } from '../api';

/** Toda la rama de reportes de la rentadora: Hoy, rentabilidad y meses. */
export const RENTAL_REPORTS_QUERY_KEY = ['rental-reports'] as const;

/** Hoy se mira de pasada: se refresca al volver a la pestaña. */
export function useRentalToday(): UseQueryResult<RentalToday, ApiError> {
  return useQuery<RentalToday, ApiError>({
    queryKey: [...RENTAL_REPORTS_QUERY_KEY, 'today'],
    queryFn: getRentalToday,
    ...ALWAYS_FRESH,
  });
}

export function useProfitability(
  query: ProfitabilityQuery,
): UseQueryResult<ProfitabilityReport, ApiError> {
  return useQuery<ProfitabilityReport, ApiError>({
    queryKey: [
      ...RENTAL_REPORTS_QUERY_KEY,
      'profitability',
      query.from,
      query.to,
      query.page,
      query.pageSize,
    ],
    queryFn: () => getProfitability(query),
    placeholderData: keepPreviousData,
  });
}

export function useVehicleMonths(
  id: string,
  year: number,
): UseQueryResult<VehicleMonths, ApiError> {
  return useQuery<VehicleMonths, ApiError>({
    queryKey: [...RENTAL_REPORTS_QUERY_KEY, 'months', id, year],
    queryFn: () => getVehicleMonths(id, year),
  });
}
