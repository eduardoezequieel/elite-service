'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { PerformanceEmployeeDetail, PerformanceReport } from '@elite/shared';

import type { ApiError } from '@/lib/api';
import type { CivilRange } from '@/lib/civil-date';
import { getEmployeePerformance, getPerformance } from '../api';
import { CARWASH_QUERY_KEY } from './use-tickets';

/**
 * Rendimiento (spec 067). Cuelga de `['carwash']`, así que un cobro que llega
 * por el hilo en vivo (042) invalida el reporte igual que la fila.
 */
export const PERFORMANCE_QUERY_KEY = [...CARWASH_QUERY_KEY, 'performance'] as const;

export function usePerformance(range: CivilRange): UseQueryResult<PerformanceReport, ApiError> {
  return useQuery<PerformanceReport, ApiError>({
    queryKey: [...PERFORMANCE_QUERY_KEY, 'team', range.from, range.to],
    queryFn: () => getPerformance({ from: range.from, to: range.to }),
  });
}

/** El detalle de un empleado. Sin empleado —o en Comisiones, que usa la 061— no sale. */
export function useEmployeePerformance(
  employeeId: string | null,
  range: CivilRange,
  enabled = true,
): UseQueryResult<PerformanceEmployeeDetail, ApiError> {
  return useQuery<PerformanceEmployeeDetail, ApiError>({
    queryKey: [...PERFORMANCE_QUERY_KEY, 'employee', employeeId, range.from, range.to],
    queryFn: () => getEmployeePerformance(employeeId ?? '', { from: range.from, to: range.to }),
    enabled: enabled && employeeId !== null,
  });
}
