'use client';

import type { VehicleWithOwner } from '@elite/shared';
import { useQuery } from '@tanstack/react-query';

import type { ApiError } from '@/lib/api';
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from '@/lib/use-debounced-value';
import { listVehicles } from '../api';
import { listFloorVehicles } from '../../floor/api';

/** Desde cuántos caracteres de placa se empieza a buscar (012). */
export const VEHICLE_SEARCH_MIN_LENGTH = 4;

/** Normaliza la placa para comparar (sin espacios ni guiones, en mayúsculas). */
export function normalizePlate(plate: string): string {
  return plate.toUpperCase().replace(/[\s-]/g, '');
}

/** Formatea una placa con la máscara A000-000 de El Salvador. */
export function formatPlate(value: string): string {
  const clean = value.toUpperCase().replace(/\s+/g, '');
  const match = clean.replace(/-/g, '').match(/^([A-Z])(\d{1,6})$/);

  if (match) {
    const [, letter, digits] = match;

    if (digits.length <= 3) {
      return `${letter}${digits}`;
    }

    return `${letter}${digits.slice(0, 3)}-${digits.slice(3, 6)}`;
  }

  return clean;
}

export interface VehicleSearchResult {
  vehicles: VehicleWithOwner[];
  exactMatch: VehicleWithOwner | null;
  tooShort: boolean;
  isPending: boolean;
  error: ApiError | null;
}

/**
 * Búsqueda de vehículos por placa con debounce de 250ms (012).
 *
 * Consulta el endpoint según la superficie (`scope === 'floor'` o 'carwash').
 * Si hay un resultado cuya placa normalizada coincide exactamente, lo expone
 * en `exactMatch`.
 */
export function useVehicleSearch(
  scope: string,
  plate: string,
  enabled = true,
): VehicleSearchResult {
  const clean = plate.trim();
  const debounced = useDebouncedValue(clean, SEARCH_DEBOUNCE_MS);
  const normalized = normalizePlate(debounced);
  const queryPlate = formatPlate(debounced);
  const tooShort = normalized.length < VEHICLE_SEARCH_MIN_LENGTH;
  const active = enabled && !tooShort;

  const query = useQuery<VehicleWithOwner[], ApiError>({
    queryKey: ['vehicle-search', scope, queryPlate],
    queryFn: () => (scope === 'floor' ? listFloorVehicles(queryPlate) : listVehicles(queryPlate)),
    enabled: active,
  });

  const vehicles = active ? (query.data ?? []) : [];
  const exactMatch =
    vehicles.find(
      (v) =>
        normalizePlate(v.plate) === normalized || v.plate.toUpperCase() === debounced.toUpperCase(),
    ) ?? null;

  return {
    vehicles,
    exactMatch,
    tooShort,
    isPending: active && query.isPending,
    error: active ? query.error : null,
  };
}
