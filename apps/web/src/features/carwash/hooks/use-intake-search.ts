'use client';

import type { Customer, VehicleWithOwner } from '@elite/shared';

import { SUGGESTION_LIMIT, useCustomerSearch } from './use-customer-search';
import { useVehicleSearch } from './use-vehicle-search';

/** Desde cuántos caracteres busca la caja única del alta (030). */
export const INTAKE_MIN_LENGTH = 2;

/**
 * Desde cuántos caracteres se buscan placas.
 *
 * Más bajo que el del campo de placa suelto (012): acá el usuario suele teclear
 * los tres dígitos que recuerda de una placa, y la lista está acotada.
 */
export const INTAKE_VEHICLE_MIN_LENGTH = 3;

/** Cuántos carros y cuántas personas como mucho: una lista larga no se toca. */
export const INTAKE_VEHICLE_LIMIT = 5;

export interface IntakeSearch {
  /** Carros cuya placa coincide, con su dueño vigente. */
  vehicles: VehicleWithOwner[];
  /** Personas cuyo nombre o teléfono coincide, sin repetir dueños ya listados. */
  customers: Customer[];
  /** El carro cuya placa coincide exactamente, si hay uno. */
  exactPlate: VehicleWithOwner | null;
  tooShort: boolean;
  isPending: boolean;
}

/**
 * La búsqueda de la caja única del alta: carros y personas a la vez (030).
 *
 * Son dos consultas distintas —`/vehicles?q=` busca placas, `/customers?q=`
 * busca nombres y teléfonos— y se juntan acá, no en el API: cada endpoint sigue
 * haciendo lo suyo y la pantalla es la que decide cómo se lee la mezcla.
 *
 * El carro va primero porque es lo que llega al taller y porque su fila ya trae
 * al dueño: elegirlo resuelve las dos cosas de un toque. Una persona que ya
 * aparece como dueña de un carro listado no se repite abajo.
 */
export function useIntakeSearch(
  scope: string,
  term: string,
  searchCustomers: (query: string) => Promise<Customer[]>,
  enabled = true,
): IntakeSearch {
  const clean = term.trim();
  const tooShort = clean.length < INTAKE_MIN_LENGTH;
  const active = enabled && !tooShort;

  const byPlate = useVehicleSearch(scope, clean, active, INTAKE_VEHICLE_MIN_LENGTH);
  const byName = useCustomerSearch(scope, clean, searchCustomers, active);

  const vehicles = byPlate.vehicles.slice(0, INTAKE_VEHICLE_LIMIT);
  const listedOwners = new Set(
    vehicles.map((vehicle) => vehicle.currentOwner?.id).filter((id): id is string => id !== undefined),
  );

  return {
    vehicles,
    customers: byName.suggestions
      .filter((candidate) => !listedOwners.has(candidate.id))
      .slice(0, SUGGESTION_LIMIT),
    exactPlate: byPlate.exactMatch,
    tooShort,
    isPending: byPlate.isPending || byName.isPending,
  };
}
