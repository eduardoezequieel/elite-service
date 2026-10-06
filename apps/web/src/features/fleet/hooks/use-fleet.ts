'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { MAX_PAGE_SIZE } from '@elite/shared';
import type {
  CreateFleetVehicleInput,
  FleetVehicle,
  Page,
  UpdateFleetVehicleInput,
} from '@elite/shared';

import type { ApiError } from '@/lib/api';
import {
  createFleetVehicle,
  getFleetVehicle,
  listFleetVehicles,
  updateFleetVehicle,
  type FleetVehiclesParams,
} from '../api';

export const FLEET_QUERY_KEY = ['fleet'] as const;

/** Una página de la flota (101): la lista de `/rentals/fleet`. */
export function useFleetVehicles(
  params: FleetVehiclesParams = {},
  enabled = true,
): UseQueryResult<Page<FleetVehicle>, ApiError> {
  return useQuery<Page<FleetVehicle>, ApiError>({
    queryKey: [...FLEET_QUERY_KEY, 'list', params],
    queryFn: () => listFleetVehicles(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/**
 * Los carros para elegir uno (la multa, por ejemplo): la
 * primera página con el tope de filas, ya como lista. Una flota de más de
 * `MAX_PAGE_SIZE` carros dejaría afuera a los últimos (101).
 */
export function useFleetVehicleOptions(
  params: Omit<FleetVehiclesParams, 'page' | 'pageSize'> = {},
  enabled = true,
): UseQueryResult<FleetVehicle[], ApiError> {
  return useQuery<Page<FleetVehicle>, ApiError, FleetVehicle[]>({
    queryKey: [...FLEET_QUERY_KEY, 'list', { ...params, pageSize: MAX_PAGE_SIZE }],
    queryFn: () => listFleetVehicles({ ...params, pageSize: MAX_PAGE_SIZE }),
    select: (page) => page.items,
    enabled,
  });
}

export function useFleetVehicle(
  id: string,
  enabled = true,
): UseQueryResult<FleetVehicle, ApiError> {
  return useQuery<FleetVehicle, ApiError>({
    queryKey: [...FLEET_QUERY_KEY, id],
    queryFn: () => getFleetVehicle(id),
    enabled,
  });
}

/** Un alta o un cambio invalida toda la rama: la lista, la ficha y su marco leen el mismo carro. */
function useFleetInvalidation() {
  const queryClient = useQueryClient();

  return () => void queryClient.invalidateQueries({ queryKey: FLEET_QUERY_KEY });
}

export function useCreateFleetVehicle() {
  const invalidate = useFleetInvalidation();

  return useMutation<FleetVehicle, ApiError, CreateFleetVehicleInput>({
    mutationFn: createFleetVehicle,
    onSuccess: invalidate,
  });
}

export function useUpdateFleetVehicle() {
  const invalidate = useFleetInvalidation();

  return useMutation<FleetVehicle, ApiError, { id: string; input: UpdateFleetVehicleInput }>({
    mutationFn: ({ id, input }) => updateFleetVehicle(id, input),
    onSuccess: invalidate,
  });
}
