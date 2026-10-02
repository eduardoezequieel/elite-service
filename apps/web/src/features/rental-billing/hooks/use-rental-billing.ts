'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  BillingAgreementView,
  CreateFineInput,
  CreatePaymentInput,
  DepositReturnInput,
  DepositsHeldList,
  FineResolution,
  Page,
  ReceivablesList,
  RentalCashReport,
  RentalFine,
  RentalPayment,
  VoidPaymentInput,
} from '@elite/shared';

import type { ApiError } from '@/lib/api';
import { ALWAYS_FRESH } from '@/lib/freshness';
import {
  addRentalPayment,
  createRentalFine,
  getRentalCash,
  listAgreementPayments,
  listDepositsHeld,
  listReceivables,
  listRentalFines,
  resolveRentalFine,
  returnRentalDeposit,
  voidRentalPayment,
} from '../api';

/** La caja del día. Las claves de la renta (`rental-agreement`, `rental-agreements`) son de la 096. */
export const RENTAL_CASH_QUERY_KEY = ['rental-cash'] as const;
/** Pagos de una renta, multas, depósitos y por cobrar paginados (101). */
export const RENTAL_PAYMENTS_QUERY_KEY = ['rental-payments'] as const;
export const RENTAL_FINES_QUERY_KEY = ['rental-fines'] as const;
export const RENTAL_DEPOSITS_QUERY_KEY = ['rental-deposits-held'] as const;
export const RENTAL_RECEIVABLES_QUERY_KEY = ['rental-receivables'] as const;

/** Filas por página de la caja (101). */
export const CASH_PAGE_SIZE = 25;
/** Filas por página del panel de cobros de una renta (101). */
export const BILLING_PANEL_PAGE_SIZE = 10;

export function useRentalCash(
  date: string,
  page: number,
): UseQueryResult<RentalCashReport, ApiError> {
  return useQuery<RentalCashReport, ApiError>({
    queryKey: [...RENTAL_CASH_QUERY_KEY, date, page],
    queryFn: () => getRentalCash(date, { page, pageSize: CASH_PAGE_SIZE }),
    placeholderData: keepPreviousData,
    ...ALWAYS_FRESH,
  });
}

export function useDepositsHeld(page: number): UseQueryResult<DepositsHeldList, ApiError> {
  return useQuery<DepositsHeldList, ApiError>({
    queryKey: [...RENTAL_DEPOSITS_QUERY_KEY, page],
    queryFn: () => listDepositsHeld({ page, pageSize: CASH_PAGE_SIZE }),
    placeholderData: keepPreviousData,
    ...ALWAYS_FRESH,
  });
}

export function useReceivables(page: number): UseQueryResult<ReceivablesList, ApiError> {
  return useQuery<ReceivablesList, ApiError>({
    queryKey: [...RENTAL_RECEIVABLES_QUERY_KEY, page],
    queryFn: () => listReceivables({ page, pageSize: CASH_PAGE_SIZE }),
    placeholderData: keepPreviousData,
    ...ALWAYS_FRESH,
  });
}

/** Una página de los pagos de una renta, para el panel de cobros. */
export function useAgreementPayments(
  agreementId: string,
  page: number,
): UseQueryResult<Page<RentalPayment>, ApiError> {
  return useQuery<Page<RentalPayment>, ApiError>({
    queryKey: [...RENTAL_PAYMENTS_QUERY_KEY, agreementId, page],
    queryFn: () => listAgreementPayments(agreementId, { page, pageSize: BILLING_PANEL_PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
}

/** Una página de las multas ligadas a una renta, para el panel de cobros. */
export function useAgreementFines(
  agreementId: string,
  page: number,
): UseQueryResult<Page<RentalFine>, ApiError> {
  return useQuery<Page<RentalFine>, ApiError>({
    queryKey: [...RENTAL_FINES_QUERY_KEY, agreementId, page],
    queryFn: () => listRentalFines({ agreementId, page, pageSize: BILLING_PANEL_PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
}

/** A quién se le cargaría una multa. Solo pregunta con carro e instante completos. */
export function useFineResolution(
  vehicleId: string,
  occurredAt: string | null,
): UseQueryResult<FineResolution, ApiError> {
  return useQuery<FineResolution, ApiError>({
    queryKey: ['rental-fine-resolve', vehicleId, occurredAt],
    queryFn: () => resolveRentalFine({ vehicleId, occurredAt: occurredAt ?? '' }),
    enabled: vehicleId !== '' && occurredAt !== null,
  });
}

/**
 * Tras cualquier movimiento de dinero: el detalle de la renta, la lista de
 * rentas (muestra saldo), la caja, los pagos y multas paginados, los depósitos
 * en custodia y las cuentas por cobrar.
 */
function useBillingInvalidation() {
  const queryClient = useQueryClient();

  return (agreementId: string | null) => {
    if (agreementId !== null) {
      void queryClient.invalidateQueries({ queryKey: ['rental-agreement', agreementId] });
    }
    void queryClient.invalidateQueries({ queryKey: ['rental-agreements'] });
    void queryClient.invalidateQueries({ queryKey: RENTAL_CASH_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: RENTAL_PAYMENTS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: RENTAL_FINES_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: RENTAL_DEPOSITS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: RENTAL_RECEIVABLES_QUERY_KEY });
  };
}

export function useAddRentalPayment(agreementId: string) {
  const invalidate = useBillingInvalidation();

  return useMutation<RentalPayment, ApiError, CreatePaymentInput>({
    mutationFn: (input) => addRentalPayment(agreementId, input),
    onSuccess: () => invalidate(agreementId),
  });
}

export function useVoidRentalPayment() {
  const invalidate = useBillingInvalidation();

  return useMutation<RentalPayment, ApiError, { paymentId: string; input: VoidPaymentInput }>({
    mutationFn: ({ paymentId, input }) => voidRentalPayment(paymentId, input),
    onSuccess: (payment) => invalidate(payment.agreementId),
  });
}

export function useReturnRentalDeposit(agreementId: string) {
  const invalidate = useBillingInvalidation();

  return useMutation<BillingAgreementView, ApiError, DepositReturnInput>({
    mutationFn: (input) => returnRentalDeposit(agreementId, input),
    onSuccess: () => invalidate(agreementId),
  });
}

export function useCreateRentalFine() {
  const invalidate = useBillingInvalidation();

  return useMutation<RentalFine, ApiError, CreateFineInput>({
    mutationFn: createRentalFine,
    onSuccess: (fine) => invalidate(fine.agreementId),
  });
}
