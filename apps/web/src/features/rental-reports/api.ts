import type {
  ProfitabilityQuery,
  ProfitabilityReport,
  RentalDashboard,
  VehicleMonths,
} from '@elite/shared';

import { apiFetch } from '@/lib/api';

/** API del inicio y la rentabilidad de la rentadora (100). */

export function getRentalDashboard(): Promise<RentalDashboard> {
  return apiFetch<RentalDashboard>('/rentals/reports/dashboard');
}

export function getProfitability(query: ProfitabilityQuery): Promise<ProfitabilityReport> {
  const search = new URLSearchParams({ from: query.from, to: query.to });

  return apiFetch<ProfitabilityReport>(`/rentals/reports/profitability?${search.toString()}`);
}

export function getVehicleMonths(id: string, year: number): Promise<VehicleMonths> {
  return apiFetch<VehicleMonths>(`/fleet/vehicles/${id}/months?year=${year}`);
}
