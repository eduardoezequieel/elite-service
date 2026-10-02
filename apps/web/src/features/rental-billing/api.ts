import type {
  BillingAgreementView,
  CreateFineInput,
  CreatePaymentInput,
  DepositReturnInput,
  DepositsHeldList,
  FineResolution,
  FineResolveQuery,
  FinesQuery,
  Page,
  PageQuery,
  ReceivablesList,
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

function pageSearch(page: PageQuery): URLSearchParams {
  return new URLSearchParams({ page: String(page.page), pageSize: String(page.pageSize) });
}

/** La caja de un día; `page` es la de los cobros vigentes (101). */
export function getRentalCash(date: string, page: PageQuery): Promise<RentalCashReport> {
  const search = pageSearch(page);
  search.set('date', date);

  return apiFetch<RentalCashReport>(`/rentals/cash?${search.toString()}`);
}

/** Una página de los pagos de una renta, el último primero (101). */
export function listAgreementPayments(
  agreementId: string,
  page: PageQuery,
): Promise<Page<RentalPayment>> {
  return apiFetch<Page<RentalPayment>>(
    `/rentals/agreements/${agreementId}/payments?${pageSearch(page).toString()}`,
  );
}

/** Una página de multas (101). */
export function listRentalFines(query: FinesQuery): Promise<Page<RentalFine>> {
  const search = pageSearch(query);
  if (query.agreementId !== undefined) search.set('agreementId', query.agreementId);
  if (query.vehicleId !== undefined) search.set('vehicleId', query.vehicleId);
  if (query.from !== undefined) search.set('from', query.from);
  if (query.to !== undefined) search.set('to', query.to);

  return apiFetch<Page<RentalFine>>(`/rentals/fines?${search.toString()}`);
}

export function listDepositsHeld(page: PageQuery): Promise<DepositsHeldList> {
  return apiFetch<DepositsHeldList>(`/rentals/deposits-held?${pageSearch(page).toString()}`);
}

export function listReceivables(page: PageQuery): Promise<ReceivablesList> {
  return apiFetch<ReceivablesList>(`/rentals/receivables?${pageSearch(page).toString()}`);
}
