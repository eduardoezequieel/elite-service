'use client';

import { useQuery } from '@tanstack/react-query';
import type { RoleSummary } from '@elite/shared';

import { ApiError } from '@/lib/api';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { listAssignableRoles } from '../api';

/**
 * Clave de cache del catalogo de roles visto desde usuarios. Cuelga de
 * `['roles']` para que invalidar los roles tambien refresque este selector.
 */
export const ASSIGNABLE_ROLES_QUERY_KEY = ['roles', 'assignable'] as const;

export interface AssignableRoles {
  /** Los roles que se pueden asignar. Vacio mientras no haya respuesta. */
  roles: RoleSummary[];
  /** El catalogo todavia esta en camino. */
  isLoading: boolean;
  /**
   * El usuario no puede leer el catalogo de roles (le falta `roles.read`).
   * El formulario se dibuja sin selector y lo dice; no se rompe la pantalla.
   */
  isForbidden: boolean;
  /** Fallo distinto a un 403: red, servidor, etc. */
  error: ApiError | null;
}

/**
 * El catalogo de roles para el selector del dialogo de usuarios.
 *
 * `users.manage` y `roles.read` son permisos independientes: hay quien puede
 * administrar usuarios sin poder ver los roles. En ese caso no se pide el
 * catalogo (o el API responde 403) y el formulario se entrega sin selector,
 * con una linea que explica por que.
 */
export function useAssignableRoles(enabled = true): AssignableRoles {
  const { can, isLoading: isLoadingPermissions } = usePermissions();
  const canReadRoles = can('roles.read');
  const isEnabled = enabled && canReadRoles && !isLoadingPermissions;

  const query = useQuery<RoleSummary[], ApiError>({
    queryKey: ASSIGNABLE_ROLES_QUERY_KEY,
    queryFn: async () => {
      const roles = await listAssignableRoles();

      return roles.map(({ id, name }) => ({ id, name }));
    },
    enabled: isEnabled,
    retry: false,
  });

  const error = query.error ?? null;
  const isForbidden = (!isLoadingPermissions && !canReadRoles) || error?.status === 403;

  return {
    roles: query.data ?? [],
    isLoading: isLoadingPermissions || (isEnabled && query.isPending),
    isForbidden,
    error: isForbidden ? null : error,
  };
}
