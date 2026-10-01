'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type {
  RentalSettings,
  RentalSettingsInput,
  StoredFileKind,
  StoredFileRef,
} from '@elite/shared';

import type { ApiError } from '@/lib/api';
import { getRentalSettings, saveRentalSettings, uploadRentalFile } from '../api';

export const RENTAL_SETTINGS_QUERY_KEY = ['rental-settings'] as const;

/** Los ajustes de la rentadora. La primera lectura crea la fila con los valores por defecto. */
export function useRentalSettings(enabled = true): UseQueryResult<RentalSettings, ApiError> {
  return useQuery<RentalSettings, ApiError>({
    queryKey: RENTAL_SETTINGS_QUERY_KEY,
    queryFn: getRentalSettings,
    enabled,
  });
}

export function useSaveRentalSettings() {
  const queryClient = useQueryClient();

  return useMutation<RentalSettings, ApiError, RentalSettingsInput>({
    mutationFn: saveRentalSettings,
    onSuccess: (saved) => queryClient.setQueryData(RENTAL_SETTINGS_QUERY_KEY, saved),
  });
}

export function useUploadRentalFile() {
  return useMutation<StoredFileRef, ApiError, { kind: StoredFileKind; file: Blob; name: string }>({
    mutationFn: ({ kind, file, name }) => uploadRentalFile(kind, file, name),
  });
}
