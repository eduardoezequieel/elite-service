'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type {
  BillingAgreementView,
  CreateFineInput,
  CreatePaymentInput,
  DepositReturnInput,
  FineResolution,
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
  resolveRentalFine,
  returnRentalDeposit,
  voidRentalPayment,
} from '../api';

/** La caja del día. Las claves de la renta (`rental-agreement`, `rental-agreements`) son de la 096. */
export const RENTAL_CASH_QUERY_KEY = ['rental-cash'] as const;

export function useRentalCash(date: string): UseQueryResult<RentalCashReport, ApiError> {
  return useQuery<RentalCashReport, ApiError>({
    queryKey: [...RENTAL_CASH_QUERY_KEY, date],
    queryFn: () => getRentalCash(date),
    ...ALWAYS_FRESH,
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
 * rentas (muestra saldo), la caja y las multas.
 */
function useBillingInvalidation() {
  const queryClient = useQueryClient();

  return (agreementId: string | null) => {
    if (agreementId !== null) {
      void queryClient.invalidateQueries({ queryKey: ['rental-agreement', agreementId] });
    }
    void queryClient.invalidateQueries({ queryKey: ['rental-agreements'] });
    void queryClient.invalidateQueries({ queryKey: RENTAL_CASH_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ['rental-fines'] });
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
