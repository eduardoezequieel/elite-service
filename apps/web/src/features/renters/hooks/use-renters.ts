'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type {
  CreateRenterInput,
  ImportRentersInput,
  Renter,
  RenterImportResult,
  RentersQuery,
  UpdateRenterInput,
} from '@elite/shared';

import type { ApiError } from '@/lib/api';
import { createRenter, getRenter, importRenters, listRenters, updateRenter } from '../api';

export const RENTERS_QUERY_KEY = ['renters'] as const;

export function useRenters(
  params: RentersQuery = {},
  enabled = true,
): UseQueryResult<Renter[], ApiError> {
  return useQuery<Renter[], ApiError>({
    queryKey: [...RENTERS_QUERY_KEY, 'list', params],
    queryFn: () => listRenters(params),
    enabled,
  });
}

export function useRenter(id: string, enabled = true): UseQueryResult<Renter, ApiError> {
  return useQuery<Renter, ApiError>({
    queryKey: [...RENTERS_QUERY_KEY, id],
    queryFn: () => getRenter(id),
    enabled,
  });
}

function useRentersInvalidation() {
  const queryClient = useQueryClient();

  return () => void queryClient.invalidateQueries({ queryKey: RENTERS_QUERY_KEY });
}

export function useCreateRenter() {
  const invalidate = useRentersInvalidation();

  return useMutation<Renter, ApiError, CreateRenterInput>({
    mutationFn: createRenter,
    onSuccess: invalidate,
  });
}

export function useUpdateRenter() {
  const invalidate = useRentersInvalidation();

  return useMutation<Renter, ApiError, { id: string; input: UpdateRenterInput }>({
    mutationFn: ({ id, input }) => updateRenter(id, input),
    onSuccess: invalidate,
  });
}

export function useImportRenters() {
  const invalidate = useRentersInvalidation();

  return useMutation<RenterImportResult, ApiError, ImportRentersInput>({
    mutationFn: importRenters,
    onSuccess: invalidate,
  });
}
