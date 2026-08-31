'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type { LoginInput, SessionResponse } from '@elite/shared';

import { ApiError } from '@/lib/api';
import { getSession, login, logout } from '../api';

/** Clave de cache de la sesion. Todo lo demas se invalida contra ella. */
export const SESSION_QUERY_KEY = ['auth', 'session'] as const;

/**
 * La sesion vigente.
 *
 * Un 401 no es un fallo del que valga la pena reintentar: significa que no hay
 * sesion. Se devuelve como `data: null` en vez de propagarse como error, para
 * que las pantallas distingan "no hay sesion" de "el servidor no responde".
 */
export function useSession(): UseQueryResult<SessionResponse | null, ApiError> {
  return useQuery<SessionResponse | null, ApiError>({
    queryKey: SESSION_QUERY_KEY,
    queryFn: async () => {
      try {
        return await getSession();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return null;
        }

        throw error;
      }
    },
    retry: false,
    staleTime: 0,
  });
}

/** Inicia sesion y deja la sesion en cache sin una vuelta extra al servidor. */
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation<SessionResponse, ApiError, LoginInput>({
    mutationFn: async (input) => {
      const result = await login(input);

      return {
        user: result.user,
        roles: result.user.roles,
        permissions: result.permissions,
      };
    },
    onSuccess: (session) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, session);
    },
  });
}

/** Cierra sesion y limpia toda la cache: nada de la sesion anterior sobrevive. */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, void>({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(SESSION_QUERY_KEY, null);
      queryClient.clear();
    },
  });
}
