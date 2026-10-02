'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { API_ERROR_CODES } from '@elite/shared';
import type {
  AuthorizePriceInput,
  Charge,
  CommissionEmployeeDetail,
  CommissionReport,
  CreateChargeInput,
  VoidChargeInput,
  CreateOfficeTicketInput,
  PutWashersInput,
  SetTicketResponsibleInput,
  ReverseTicketInput,
  SetTicketStatusInput,
  Ticket,
  TicketListPage,
  TicketTimeline,
  UpdateTicketInput,
  VoidTicketInput,
} from '@elite/shared';

import type { ApiError } from '@/lib/api';
import { ALWAYS_FRESH, listPollMs } from '@/lib/freshness';
import { useCarwashLive } from './use-carwash-live';
import {
  authorizeItemPrice,
  createCharge,
  createTicket,
  getCommissions,
  getEmployeeCommissions,
  getTicket,
  getTicketTimeline,
  listBodyTypes,
  listCustomers,
  listEmployees,
  listServices,
  listTickets,
  markReady,
  putTicketWashers,
  reopenTicket,
  reverseTicket,
  setTicketResponsible,
  setTicketStatus,
  updateTicket,
  updateTicketNotes,
  voidCharge,
  voidTicket,
  type RangePageParams,
  type TicketsParams,
} from '../api';
import { CASH_QUERY_KEY } from './use-cash';

/** Todo lo del lavado cuelga de acá: lista, detalle, caja, catálogos. */
export const CARWASH_QUERY_KEY = ['carwash'] as const;
export const TICKETS_QUERY_KEY = [...CARWASH_QUERY_KEY, 'tickets'] as const;

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

/**
 * Una página de lavados (102). `summary` y `facets` son del día entero: las
 * cifras y contadores salen de ahí, nunca de `items`.
 */
export function useTickets(
  params: TicketsParams = {},
  enabled = true,
): UseQueryResult<TicketListPage, ApiError> {
  const { isLive } = useCarwashLive();
  // Con el hilo abierto el servidor avisa, pero un evento perdido sin que se
  // caiga la conexión no se nota: cada 60 s se pide igual (062). Sin hilo,
  // vuelve el respaldo de 15 s de la spec 019. Por hook, jamás global.
  const polled = params.customerId === undefined;

  return useQuery<TicketListPage, ApiError>({
    queryKey: [...TICKETS_QUERY_KEY, params],
    queryFn: () => listTickets(params),
    // Al cambiar de página o de filtro la tabla no parpadea a «Cargando…».
    placeholderData: keepPreviousData,
    enabled,
    refetchInterval: polled ? listPollMs(isLive) : false,
    ...ALWAYS_FRESH,
  });
}

export function useTicket(id: string, enabled = true): UseQueryResult<Ticket, ApiError> {
  return useQuery<Ticket, ApiError>({
    queryKey: [...TICKETS_QUERY_KEY, id],
    queryFn: () => getTicket(id),
    enabled,
    ...ALWAYS_FRESH,
  });
}

/**
 * La línea de tiempo del lavado (046). Cuelga de `TICKETS_QUERY_KEY`, así que
 * cualquier mutación —o un aviso del stream— la invalida junto con el ticket:
 * mostrar el estado nuevo sobre una historia vieja sería peor que no mostrarla.
 */
export function useTicketTimeline(
  id: string,
  enabled = true,
): UseQueryResult<TicketTimeline, ApiError> {
  return useQuery<TicketTimeline, ApiError>({
    queryKey: [...TICKETS_QUERY_KEY, id, 'timeline'],
    queryFn: () => getTicketTimeline(id),
    enabled,
    ...ALWAYS_FRESH,
  });
}

export function useCreateTicket() {
  const invalidate = useTicketInvalidation();

  return useMutation<Ticket, ApiError, CreateOfficeTicketInput>({
    mutationFn: createTicket,
    onSuccess: invalidate,
  });
}

export function useTicketAction(action: 'ready' | 'reopen') {
  const invalidate = useTicketInvalidation();
  const run = { ready: markReady, reopen: reopenTicket }[action];

  return useMutation<Ticket, ApiError, string>({ mutationFn: run, onSuccess: invalidate });
}

export function useSetTicketStatus(id: string) {
  const invalidate = useTicketInvalidation();

  return useMutation<Ticket, ApiError, SetTicketStatusInput>({
    mutationFn: (input) => setTicketStatus(id, input),
    onSuccess: invalidate,
  });
}

export function useVoidTicket() {
  const invalidate = useTicketInvalidation();

  return useMutation<Ticket, ApiError, { id: string } & VoidTicketInput>({
    mutationFn: ({ id, ...input }) => voidTicket(id, input),
    onSuccess: invalidate,
  });
}

export function useUpdateTicket(id: string) {
  const invalidate = useTicketInvalidation();

  return useMutation<Ticket, ApiError, UpdateTicketInput>({
    mutationFn: (input) => updateTicket(id, input),
    onSuccess: invalidate,
  });
}

export function useUpdateTicketNotes(id: string) {
  const invalidate = useTicketInvalidation();

  return useMutation<Ticket, ApiError, string>({
    mutationFn: (notes) => updateTicketNotes(id, { notes }),
    onSuccess: invalidate,
  });
}

export function useReverseTicket(id: string) {
  const queryClient = useQueryClient();
  const invalidate = useTicketInvalidation();

  return useMutation<Ticket, ApiError, ReverseTicketInput>({
    mutationFn: (input) => reverseTicket(id, input),
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: CASH_QUERY_KEY });
    },
  });
}

export function useSetTicketResponsible(id: string) {
  const invalidate = useTicketInvalidation();

  return useMutation<Ticket, ApiError, SetTicketResponsibleInput>({
    mutationFn: (input) => setTicketResponsible(id, input),
    onSuccess: invalidate,
  });
}

/**
 * Cobrar la cuenta (059). Un solo camino para el lavado suelto y para el
 * mancomunado: lo que cambia es cuántos ids viajan.
 *
 * Invalida la fila **y** la caja: el cobro mueve los dos, y la cuenta pudo
 * cobrar lavados que la pantalla no tenía a la vista.
 */
/**
 * Lo que mueve una cuenta con productos sueltos además de los lavados (066): la
 * lista de ventas y la existencia. Se nombran por su prefijo —`['sales']`,
 * `['inventory']`— para no importar los hooks de esos módulos, que ya importan
 * de este.
 */
const ACCOUNT_SIDE_KEYS = [['sales'], ['inventory']] as const;

/** Las cuentas bancarias del cobro (069), por prefijo. */
const BANKING_KEY = ['banking'] as const;

/** Cobrar una cuenta: lavados, productos sueltos o las dos cosas (059, 066). */
export function useCreateCharge() {
  const queryClient = useQueryClient();
  const invalidate = useTicketInvalidation();

  return useMutation<Charge, ApiError, CreateChargeInput>({
    mutationFn: createCharge,
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: CASH_QUERY_KEY });
      for (const queryKey of ACCOUNT_SIDE_KEYS) void queryClient.invalidateQueries({ queryKey });
    },
    // Todo o nada (065 RN-19): si no alcanzó un producto, el buscador tiene que
    // volver a decir cuánto hay.
    onError: (error) => {
      if (error.code === API_ERROR_CODES.INSUFFICIENT_STOCK) {
        for (const queryKey of ACCOUNT_SIDE_KEYS) void queryClient.invalidateQueries({ queryKey });
      }
      // La cuenta se desactivó mientras se cobraba (069): el selector tiene que
      // dejar de ofrecerla. Por prefijo, como los de arriba.
      if (error.code === API_ERROR_CODES.BANK_ACCOUNT_UNAVAILABLE) {
        void queryClient.invalidateQueries({ queryKey: BANKING_KEY });
      }
    },
  });
}

/**
 * Deshacer la cuenta entera (059 RN-8, 066): vuelven a listo todos sus lavados
 * y su venta suelta se anula.
 */
export function useVoidCharge(chargeId: string) {
  const queryClient = useQueryClient();
  const invalidate = useTicketInvalidation();

  return useMutation<void, ApiError, VoidChargeInput>({
    mutationFn: (input) => voidCharge(chargeId, input),
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: CASH_QUERY_KEY });
      for (const queryKey of ACCOUNT_SIDE_KEYS) void queryClient.invalidateQueries({ queryKey });
    },
  });
}

/**
 * Cambiar el precio de una línea con la firma de un administrador (060).
 * Invalida como cualquier cambio del ticket: el total se recalcula en el
 * backend y quedarse con la copia vieja mostraría un precio que ya no es.
 */
export function useAuthorizePrice(ticketId: string, itemId: string) {
  const invalidate = useTicketInvalidation();

  return useMutation<Ticket, ApiError, AuthorizePriceInput>({
    mutationFn: (input) => authorizeItemPrice(ticketId, itemId, input),
    onSuccess: invalidate,
  });
}

// --- catalogos de apoyo. Cambian poco, asi que se cachean mas tiempo. ---

const CATALOG_STALE_MS = 30 * 1000;

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

export const COMMISSIONS_QUERY_KEY = [...CARWASH_QUERY_KEY, 'commissions'] as const;

export function useCommissions(
  params: RangePageParams,
  enabled = true,
): UseQueryResult<CommissionReport, ApiError> {
  return useQuery<CommissionReport, ApiError>({
    queryKey: [...COMMISSIONS_QUERY_KEY, params],
    queryFn: () => getCommissions(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Cuelga de la misma clave: lo que invalida el reporte invalida el detalle (061). */
export function useEmployeeCommissions(
  employeeId: string,
  params: RangePageParams,
): UseQueryResult<CommissionEmployeeDetail, ApiError> {
  return useQuery<CommissionEmployeeDetail, ApiError>({
    queryKey: [...COMMISSIONS_QUERY_KEY, 'employee', employeeId, params],
    queryFn: () => getEmployeeCommissions(employeeId, params),
    placeholderData: keepPreviousData,
  });
}
