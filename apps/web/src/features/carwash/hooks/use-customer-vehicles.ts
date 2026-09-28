'use client';

import type { VehicleWithOwner } from '@elite/shared';
import { queryOptions, useQuery, type UseQueryResult } from '@tanstack/react-query';

/** Cómo se piden los carros de un cliente: la pista y la oficina pasan el suyo. */
export type ListCustomerVehicles = (customerId: string) => Promise<VehicleWithOwner[]>;

/**
 * Los carros de un cliente recién elegido en el alta, para saber cuál trajo
 * (026). La misma consulta la usa la lista «¿Cuál trajo?» y el `fetchQuery`
 * con que la ficha decide sola cuando hay uno o ninguno.
 */
export function customerVehiclesQuery(
  scope: string,
  customerId: string | null,
  list: ListCustomerVehicles | undefined,
) {
  return queryOptions<VehicleWithOwner[]>({
    queryKey: ['customer-vehicles', scope, customerId],
    queryFn: () => (customerId && list ? list(customerId) : Promise.resolve([])),
    enabled: Boolean(customerId && list),
  });
}

export function useCustomerVehicles(
  scope: string,
  customerId: string | null,
  list: ListCustomerVehicles | undefined,
): UseQueryResult<VehicleWithOwner[]> {
  return useQuery(customerVehiclesQuery(scope, customerId, list));
}
