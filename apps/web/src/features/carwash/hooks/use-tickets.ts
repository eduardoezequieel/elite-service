'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type {
  ChargeTicketInput,
  CommissionReport,
  CreateOfficeTicketInput,
  PutWashersInput,
  Ticket,
  UpdateTicketInput,
} from '@elite/shared';

import type { ApiError } from '@/lib/api';
import {
  chargeTicket,
  createTicket,
  getCommissions,
  getTicket,
  listBodyTypes,
  listCustomers,
  listEmployees,
  listServices,
  listTickets,
  markReady,
  putTicketWashers,
  reopenTicket,
  updateTicket,
  voidTicket,
} from '../api';
import { CASH_QUERY_KEY } from './use-cash';

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
  params: { status?: string; date?: string; customerId?: string; q?: string } = {},
  enabled = true,
): UseQueryResult<Ticket[], ApiError> {
  return useQuery<Ticket[], ApiError>({
    queryKey: [...TICKETS_QUERY_KEY, params],
    queryFn: () => listTickets(params),
    enabled,
    refetchInterval: params.customerId === undefined ? 15_000 : false,
    refetchOnWindowFocus: true,
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

export function useUpdateTicket(id: string) {
  const invalidate = useTicketInvalidation();

  return useMutation<Ticket, ApiError, UpdateTicketInput>({
    mutationFn: (input) => updateTicket(id, input),
    onSuccess: invalidate,
  });
}

export function useChargeTicket(id: string) {
  const queryClient = useQueryClient();
  const invalidate = useTicketInvalidation();

  return useMutation<Ticket, ApiError, ChargeTicketInput>({
    mutationFn: (input) => chargeTicket(id, input),
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: CASH_QUERY_KEY });
    },
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

export function useSetTicketWashers(id: string) {
  const invalidate = useTicketInvalidation();

  return useMutation<Ticket, ApiError, PutWashersInput>({
    mutationFn: (input) => putTicketWashers(id, input),
    onSuccess: invalidate,
  });
}

export const COMMISSIONS_QUERY_KEY = ['carwash', 'commissions'] as const;

export function useCommissions(
  params: { from?: string; to?: string },
  enabled = true,
): UseQueryResult<CommissionReport, ApiError> {
  return useQuery<CommissionReport, ApiError>({
    queryKey: [...COMMISSIONS_QUERY_KEY, params],
    queryFn: () => getCommissions(params),
    enabled,
  });
}
