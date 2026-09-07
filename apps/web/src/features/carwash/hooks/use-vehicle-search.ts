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

/**
 * Formatea una placa con la máscara de El Salvador.
 *
 * Prefijo de 1 o 2 letras (P, C, M, MB, AB...) seguido de hasta 6 dígitos.
 * El guion se coloca tras los primeros 3 dígitos (ej: P123-456, MB123-456).
 * Si se ingresan números directamente, se asume el prefijo 'P'.
 * Cualquier dígito adicional más allá de 6 o carácter inválido se descarta.
 */
export function formatPlate(value: string): string {
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) return '';

  const startsWithNumber = /^\d/.test(clean);
  const normalized = startsWithNumber ? `P${clean}` : clean;

  const match = normalized.match(/^([A-Z]{1,2})(\d*)/);
  if (!match) return '';

  const letters = match[1];
  const digits = match[2].slice(0, 6);

  if (digits.length === 0) {
    return letters;
  }

  if (digits.length <= 3) {
    return `${letters}${digits}`;
  }

  return `${letters}${digits.slice(0, 3)}-${digits.slice(3, 6)}`;
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
  /** Desde cuántos caracteres buscar. La caja única del alta baja a 3 (030). */
  minLength: number = VEHICLE_SEARCH_MIN_LENGTH,
): VehicleSearchResult {
  const clean = plate.trim();
  const debounced = useDebouncedValue(clean, SEARCH_DEBOUNCE_MS);
  const normalized = normalizePlate(debounced);
  const queryPlate = formatPlate(debounced);
  const tooShort = normalized.length < minLength;
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
