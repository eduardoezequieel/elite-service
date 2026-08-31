'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type { CreateRoleInput, RoleDetail, UpdateRoleInput } from '@elite/shared';

import type { ApiError } from '@/lib/api';
import { SESSION_QUERY_KEY } from '@/features/auth/hooks/use-session';
import { createRole, deleteRole, listRoles, updateRole } from '../api';

/** Clave de cache de la lista de roles. */
export const ROLES_QUERY_KEY = ['roles'] as const;

/**
 * Invalida la lista de roles y, ademas, la sesion.
 *
 * Tocar un rol puede cambiar los permisos efectivos del propio usuario en el
 * acto (RN-6b): si no se refresca la sesion, la pantalla sigue mostrando
 * acciones que el backend ya no autoriza.
 */
function useRolesInvalidation() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: ROLES_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
  };
}

/**
 * La lista de roles. Requiere `roles.read`: se pasa `enabled` en `false`
 * mientras la sesion no se resolvio o el usuario no tiene el permiso, para no
 * disparar un 403 evitable.
 */
export function useRoles(enabled = true): UseQueryResult<RoleDetail[], ApiError> {
  return useQuery<RoleDetail[], ApiError>({
    queryKey: ROLES_QUERY_KEY,
    queryFn: listRoles,
    enabled,
  });
}

/** Crea un rol. Requiere `roles.manage`. */
export function useCreateRole() {
  const invalidate = useRolesInvalidation();

  return useMutation<RoleDetail, ApiError, CreateRoleInput>({
    mutationFn: createRole,
    onSuccess: invalidate,
  });
}

/** Edita un rol. `permissionKeys` reemplaza el conjunto completo de permisos. */
export function useUpdateRole() {
  const invalidate = useRolesInvalidation();

  return useMutation<RoleDetail, ApiError, { id: string; input: UpdateRoleInput }>({
    mutationFn: ({ id, input }) => updateRole(id, input),
    onSuccess: invalidate,
  });
}

/** Elimina un rol. El API rechaza con `409 ROLE_IN_USE` si tiene usuarios (RN-6). */
export function useDeleteRole() {
  const invalidate = useRolesInvalidation();

  return useMutation<void, ApiError, string>({
    mutationFn: deleteRole,
    onSuccess: invalidate,
  });
}
