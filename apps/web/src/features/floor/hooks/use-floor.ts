'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type {
  CreateFloorTicketInput,
  FloorEmployeeOption,
  FloorLoginInput,
  FloorSessionResponse,
  PutWashersInput,
  Ticket,
  UpdateTicketInput,
} from '@elite/shared';

import { ApiError } from '@/lib/api';
import { useFloorLive } from './use-floor-live';
import {
  createFloorTicket,
  floorLogin,
  floorLogout,
  getFloorSession,
  getFloorTicket,
  listFloorBodyTypes,
  listFloorEmployees,
  listFloorServices,
  listFloorTickets,
  markFloorReady,
  putFloorTicketWashers,
  reopenFloorTicket,
  startFloorTicket,
  updateFloorTicket,
} from '../api';

export const FLOOR_SESSION_KEY = ['floor', 'session'] as const;
export const FLOOR_TICKETS_KEY = ['floor', 'tickets'] as const;

/**
 * La sesión de pista. Un 401 no es un fallo: es que no hay sesión, igual que en
 * oficina.
 */
export function useFloorSession(): UseQueryResult<FloorSessionResponse | null, ApiError> {
  return useQuery<FloorSessionResponse | null, ApiError>({
    queryKey: FLOOR_SESSION_KEY,
    queryFn: async () => {
      try {
        return await getFloorSession();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    retry: false,
    staleTime: 0,
  });
}

export function useFloorLogin() {
  const queryClient = useQueryClient();

  // Nada queda guardado en la tablet: el PIN es la credencial entera y no se
  // escribe en ningún lado del aparato (044 RN-8).
  return useMutation<FloorSessionResponse, ApiError, FloorLoginInput>({
    mutationFn: floorLogin,
    onSuccess: (session) => {
      queryClient.setQueryData(FLOOR_SESSION_KEY, session);
    },
  });
}

export function useFloorLogout() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, void>({
    mutationFn: floorLogout,
    onSuccess: () => {
      queryClient.setQueryData(FLOOR_SESSION_KEY, null);
      queryClient.clear();
    },
  });
}

export function useFloorTickets(
  params: { q?: string; date?: string } = {},
  enabled = true,
): UseQueryResult<Ticket[], ApiError> {
  const { isLive } = useFloorLive();

  return useQuery<Ticket[], ApiError>({
    queryKey: [...FLOOR_TICKETS_KEY, params],
    queryFn: () => listFloorTickets(params),
    enabled,
    // Con el hilo abierto el servidor avisa; sin él vuelve el refresco de la
    // spec 019. En la tablet importa más que nunca: nadie va a recargar.
    refetchInterval: isLive ? false : 15_000,
    refetchOnWindowFocus: true,
  });
}

export function useFloorTicket(id: string, enabled = true): UseQueryResult<Ticket, ApiError> {
  return useQuery<Ticket, ApiError>({
    queryKey: [...FLOOR_TICKETS_KEY, id],
    queryFn: () => getFloorTicket(id),
    enabled,
  });
}

function useFloorInvalidation() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: FLOOR_TICKETS_KEY });
  };
}

export function useCreateFloorTicket() {
  const invalidate = useFloorInvalidation();

  return useMutation<Ticket, ApiError, CreateFloorTicketInput>({
    mutationFn: createFloorTicket,
    onSuccess: invalidate,
  });
}

export function useFloorTicketAction(action: 'ready' | 'reopen' | 'start') {
  const invalidate = useFloorInvalidation();
  const run =
    action === 'ready' ? markFloorReady : action === 'start' ? startFloorTicket : reopenFloorTicket;

  return useMutation<Ticket, ApiError, string>({ mutationFn: run, onSuccess: invalidate });
}

export function useFloorServices(enabled = true) {
  return useQuery({
    queryKey: ['floor', 'services'],
    queryFn: listFloorServices,
    staleTime: 30 * 1000,
    enabled,
  });
}

export function useFloorBodyTypes(enabled = true) {
  return useQuery({
    queryKey: ['floor', 'body-types'],
    queryFn: listFloorBodyTypes,
    staleTime: 30 * 1000,
    enabled,
  });
}

export function useFloorEmployees(enabled = true) {
  return useQuery<FloorEmployeeOption[], ApiError>({
    queryKey: ['floor', 'employees'],
    queryFn: listFloorEmployees,
    staleTime: 30 * 1000,
    enabled,
  });
}

export function useSetFloorWashers(id: string) {
  const invalidate = useFloorInvalidation();

  return useMutation<Ticket, ApiError, PutWashersInput>({
    mutationFn: (input) => putFloorTicketWashers(id, input),
    onSuccess: invalidate,
  });
}

export function useUpdateFloorTicket(id: string) {
  const invalidate = useFloorInvalidation();

  return useMutation<Ticket, ApiError, UpdateTicketInput>({
    mutationFn: (input) => updateFloorTicket(id, input),
    onSuccess: invalidate,
  });
}
