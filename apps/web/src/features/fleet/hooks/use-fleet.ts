'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type {
  CreateFleetVehicleInput,
  FleetVehicle,
  FleetVehiclesQuery,
  UpdateFleetVehicleInput,
} from '@elite/shared';

import type { ApiError } from '@/lib/api';
import { createFleetVehicle, getFleetVehicle, listFleetVehicles, updateFleetVehicle } from '../api';

export const FLEET_QUERY_KEY = ['fleet'] as const;

export function useFleetVehicles(
  params: FleetVehiclesQuery = {},
  enabled = true,
): UseQueryResult<FleetVehicle[], ApiError> {
  return useQuery<FleetVehicle[], ApiError>({
    queryKey: [...FLEET_QUERY_KEY, 'list', params],
    queryFn: () => listFleetVehicles(params),
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
