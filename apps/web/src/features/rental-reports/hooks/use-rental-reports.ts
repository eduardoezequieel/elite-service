'use client';

import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';
import type {
  ProfitabilityQuery,
  ProfitabilityReport,
  RentalDashboard,
  VehicleMonths,
} from '@elite/shared';

import type { ApiError } from '@/lib/api';
import { ALWAYS_FRESH } from '@/lib/freshness';
import { getProfitability, getRentalDashboard, getVehicleMonths } from '../api';

/** Toda la rama de reportes de la rentadora: inicio, rentabilidad y meses. */
export const RENTAL_REPORTS_QUERY_KEY = ['rental-reports'] as const;

/** El inicio se mira de pasada: se refresca al volver a la pestaña. */
export function useRentalDashboard(): UseQueryResult<RentalDashboard, ApiError> {
  return useQuery<RentalDashboard, ApiError>({
    queryKey: [...RENTAL_REPORTS_QUERY_KEY, 'dashboard'],
    queryFn: getRentalDashboard,
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
