'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { PermissionGroup } from '@elite/shared';

import type { ApiError } from '@/lib/api';
import { listPermissions } from '../api';

/** Clave de cache del catalogo de permisos. */
export const PERMISSIONS_QUERY_KEY = ['permissions'] as const;

/**
 * El catalogo de permisos agrupado por modulo — las filas y las columnas de la
 * matriz.
 *
 * El catalogo vive en codigo y solo cambia con un despliegue (RN-2), asi que no
 * hace falta revalidarlo mientras dure la pantalla.
 */
export function usePermissionCatalog(enabled = true): UseQueryResult<PermissionGroup[], ApiError> {
  return useQuery<PermissionGroup[], ApiError>({
    queryKey: PERMISSIONS_QUERY_KEY,
    queryFn: listPermissions,
    enabled,
    staleTime: Infinity,
  });
}
