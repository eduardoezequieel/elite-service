'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import type { CreateUserInput, PublicUser, UpdateUserInput } from '@elite/shared';

import { ApiError } from '@/lib/api';
import { SESSION_QUERY_KEY } from '@/features/auth/hooks/use-session';
import { createUser, listUsers, updateUser } from '../api';

/** Clave de cache de la lista de usuarios. */
export const USERS_QUERY_KEY = ['users'] as const;

/** La lista completa de usuarios. Requiere `users.read`. */
export function useUsers(enabled = true): UseQueryResult<PublicUser[], ApiError> {
  return useQuery<PublicUser[], ApiError>({
    queryKey: USERS_QUERY_KEY,
    queryFn: listUsers,
    enabled,
    retry: false,
  });
}

/**
 * Invalida lo que un cambio de usuario puede haber movido.
 *
 * Ademas de la lista, la sesion: si el usuario editado es uno mismo, sus
 * permisos efectivos pueden haber cambiado y la navegacion depende de ellos
 * (RN-6b).
 */
function useInvalidateAfterWrite() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
  };
}

/** Crea un usuario. Requiere `users.manage`. */
export function useCreateUser(): UseMutationResult<PublicUser, ApiError, CreateUserInput> {
  const invalidate = useInvalidateAfterWrite();

  return useMutation<PublicUser, ApiError, CreateUserInput>({
    mutationFn: createUser,
    onSuccess: invalidate,
  });
}

/** Parametros de la edicion: el usuario y solo los campos que cambian. */
export interface UpdateUserVariables {
  id: string;
  input: UpdateUserInput;
}

/** Edita un usuario. Requiere `users.manage`. */
export function useUpdateUser(): UseMutationResult<PublicUser, ApiError, UpdateUserVariables> {
  const invalidate = useInvalidateAfterWrite();

  return useMutation<PublicUser, ApiError, UpdateUserVariables>({
    mutationFn: ({ id, input }) => updateUser(id, input),
    onSuccess: invalidate,
  });
}
