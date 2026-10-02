import type {
  AgreementSwapResult,
  AgreementsQuery,
  AvailabilityQuery,
  AvailabilityRow,
  CalendarRow,
  CancelInput,
  CheckinInput,
  CheckoutInput,
  CreateAgreementInput,
  ExtendInput,
  Page,
  ReassignInput,
  RentalAgreement,
  SwapInput,
  UpdateAgreementInput,
} from '@elite/shared';

import { apiFetch } from '@/lib/api';

/** API de las rentas (096): reserva, entrega, recepción, calendario y disponibilidad. */

/** Lo que pide una pantalla: el API pone la página 1 y su tamaño si no vienen. */
export type AgreementsParams = Partial<AgreementsQuery>;

/** La query de la lista. `status` viaja separado por comas. */
export function agreementsQueryString(params: AgreementsParams): string {
  const search = new URLSearchParams();
  if (params.status !== undefined && params.status.length > 0) {
    search.set('status', params.status.join(','));
  }
  if (params.late === true) search.set('late', 'true');
  if (params.customerId !== undefined) search.set('customerId', params.customerId);
  if (params.vehicleId !== undefined) search.set('vehicleId', params.vehicleId);
  if (params.from !== undefined) search.set('from', params.from);
  if (params.to !== undefined) search.set('to', params.to);
  if (params.q !== undefined && params.q !== '') search.set('q', params.q);
  if (params.page !== undefined) search.set('page', String(params.page));
  if (params.pageSize !== undefined) search.set('pageSize', String(params.pageSize));
  const text = search.toString();

  return text === '' ? '' : `?${text}`;
}

/** Una página de rentas (101). */
export function listAgreements(params: AgreementsParams = {}): Promise<Page<RentalAgreement>> {
  return apiFetch<Page<RentalAgreement>>(`/rentals/agreements${agreementsQueryString(params)}`);
}

export function getAgreement(id: string): Promise<RentalAgreement> {
  return apiFetch<RentalAgreement>(`/rentals/agreements/${id}`);
}

export function createAgreement(input: CreateAgreementInput): Promise<RentalAgreement> {
  return apiFetch<RentalAgreement>('/rentals/agreements', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateAgreement(id: string, input: UpdateAgreementInput): Promise<RentalAgreement> {
  return apiFetch<RentalAgreement>(`/rentals/agreements/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

function action<Body>(id: string, path: string, body?: Body): Promise<RentalAgreement> {
  return apiFetch<RentalAgreement>(`/rentals/agreements/${id}/${path}`, {
    method: 'POST',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export const checkoutAgreement = (id: string, input: CheckoutInput) =>
  action(id, 'checkout', input);
export const checkinAgreement = (id: string, input: CheckinInput) => action(id, 'checkin', input);
export const extendAgreement = (id: string, input: ExtendInput) => action(id, 'extend', input);
export const reassignAgreement = (id: string, input: ReassignInput) =>
  action(id, 'reassign', input);
export const cancelAgreement = (id: string, input: CancelInput) => action(id, 'cancel', input);
export const assignContractNumber = (id: string) => action(id, 'contract-number');

export function swapAgreement(id: string, input: SwapInput): Promise<AgreementSwapResult> {
  return apiFetch<AgreementSwapResult>(`/rentals/agreements/${id}/swap`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getAvailability(params: AvailabilityQuery): Promise<AvailabilityRow[]> {
  const search = new URLSearchParams({ from: params.from, to: params.to });
  if (params.category !== undefined) search.set('category', params.category);

  return apiFetch<AvailabilityRow[]>(`/rentals/availability?${search.toString()}`);
}

export function getCalendar(from: string, to: string): Promise<CalendarRow[]> {
  const search = new URLSearchParams({ from, to });

  return apiFetch<CalendarRow[]>(`/rentals/calendar?${search.toString()}`);
}
