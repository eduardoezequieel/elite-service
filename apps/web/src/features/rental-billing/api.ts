import type {
  BillingAgreementView,
  CreateFineInput,
  CreatePaymentInput,
  DepositReturnInput,
  FineResolution,
  FineResolveQuery,
  RentalCashReport,
  RentalFine,
  RentalPayment,
  VoidPaymentInput,
} from '@elite/shared';

import { apiFetch } from '@/lib/api';

/** API del dinero de la rentadora (098): pagos, depósito, multas y caja del día. */

export function addRentalPayment(
  agreementId: string,
  input: CreatePaymentInput,
): Promise<RentalPayment> {
  return apiFetch<RentalPayment>(`/rentals/agreements/${agreementId}/payments`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function voidRentalPayment(
  paymentId: string,
  input: VoidPaymentInput,
): Promise<RentalPayment> {
  return apiFetch<RentalPayment>(`/rentals/payments/${paymentId}/void`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function returnRentalDeposit(
  agreementId: string,
  input: DepositReturnInput,
): Promise<BillingAgreementView> {
  return apiFetch<BillingAgreementView>(`/rentals/agreements/${agreementId}/deposit-return`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function createRentalFine(input: CreateFineInput): Promise<RentalFine> {
  return apiFetch<RentalFine>('/rentals/fines', { method: 'POST', body: JSON.stringify(input) });
}

export function resolveRentalFine(query: FineResolveQuery): Promise<FineResolution> {
  const search = new URLSearchParams({ vehicleId: query.vehicleId, occurredAt: query.occurredAt });

  return apiFetch<FineResolution>(`/rentals/fines/resolve?${search.toString()}`);
}

export function getRentalCash(date: string): Promise<RentalCashReport> {
  return apiFetch<RentalCashReport>(`/rentals/cash?date=${encodeURIComponent(date)}`);
}
