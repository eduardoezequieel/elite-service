import type {
  ProfitabilityQuery,
  ProfitabilityReport,
  RentalToday,
  VehicleMonths,
} from '@elite/shared';

import { apiFetch } from '@/lib/api';

/** API de Hoy y la rentabilidad de la rentadora (100, 107). */

export function getRentalToday(): Promise<RentalToday> {
  return apiFetch<RentalToday>('/rentals/reports/today');
}

export function getProfitability(query: ProfitabilityQuery): Promise<ProfitabilityReport> {
  const search = new URLSearchParams({
    from: query.from,
    to: query.to,
    page: String(query.page),
    pageSize: String(query.pageSize),
  });

  return apiFetch<ProfitabilityReport>(`/rentals/reports/profitability?${search.toString()}`);
}

export function getVehicleMonths(id: string, year: number): Promise<VehicleMonths> {
  return apiFetch<VehicleMonths>(`/fleet/vehicles/${id}/months?year=${year}`);
}
