'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type { ChargeTicketInput, CreateOfficeTicketInput, Ticket } from '@elite/shared';

import type { ApiError } from '@/lib/api';
import {
  chargeTicket,
  createTicket,
  getTicket,
  listBodyTypes,
  listCustomers,
  listEmployees,
  listServices,
  listTickets,
  markReady,
  reopenTicket,
  voidTicket,
} from '../api';

export const TICKETS_QUERY_KEY = ['carwash', 'tickets'] as const;

/**
 * Cualquier cambio sobre un ticket invalida la lista **y** el detalle: el total
 * y el estado se recalculan en el backend, asi que quedarse con la copia vieja
 * mostraria un precio que ya no es (RN-6, RN-9).
 */
function useTicketInvalidation() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: TICKETS_QUERY_KEY });
  };
}

export function useTickets(
  params: { status?: string; date?: string } = {},
  enabled = true,
): UseQueryResult<Ticket[], ApiError> {
  return useQuery<Ticket[], ApiError>({
    queryKey: [...TICKETS_QUERY_KEY, params],
    queryFn: () => listTickets(params),
    enabled,
  });
}

export function useTicket(id: string, enabled = true): UseQueryResult<Ticket, ApiError> {
  return useQuery<Ticket, ApiError>({
    queryKey: [...TICKETS_QUERY_KEY, id],
    queryFn: () => getTicket(id),
    enabled,
  });
}

export function useCreateTicket() {
  const invalidate = useTicketInvalidation();

  return useMutation<Ticket, ApiError, CreateOfficeTicketInput>({
    mutationFn: createTicket,
    onSuccess: invalidate,
  });
}

export function useTicketAction(action: 'ready' | 'reopen' | 'void') {
  const invalidate = useTicketInvalidation();
  const run = { ready: markReady, reopen: reopenTicket, void: voidTicket }[action];

  return useMutation<Ticket, ApiError, string>({ mutationFn: run, onSuccess: invalidate });
}

export function useChargeTicket(id: string) {
  const invalidate = useTicketInvalidation();

  return useMutation<Ticket, ApiError, ChargeTicketInput>({
    mutationFn: (input) => chargeTicket(id, input),
    onSuccess: invalidate,
  });
}

// --- catalogos de apoyo. Cambian poco, asi que se cachean mas tiempo. ---

const CATALOG_STALE_MS = 5 * 60 * 1000;

export function useBodyTypes(enabled = true) {
  return useQuery({
    queryKey: ['carwash', 'body-types'],
    queryFn: listBodyTypes,
    staleTime: CATALOG_STALE_MS,
    enabled,
  });
}

export function useServices(enabled = true) {
  return useQuery({
    queryKey: ['carwash', 'services'],
    queryFn: listServices,
    staleTime: CATALOG_STALE_MS,
    enabled,
  });
}

export function useCustomers(query: string, enabled = true) {
  return useQuery({
    queryKey: ['carwash', 'customers', query],
    queryFn: () => listCustomers(query),
    enabled,
  });
}

export function useEmployees(enabled = true) {
  return useQuery({
    queryKey: ['carwash', 'employees'],
    queryFn: listEmployees,
    staleTime: CATALOG_STALE_MS,
    enabled,
  });
}
