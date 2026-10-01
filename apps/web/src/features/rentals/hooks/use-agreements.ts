'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
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
  ReassignInput,
  RentalAgreement,
  SwapInput,
  UpdateAgreementInput,
} from '@elite/shared';

import { FLEET_QUERY_KEY } from '@/features/fleet/hooks/use-fleet';
import type { ApiError } from '@/lib/api';
import {
  assignContractNumber,
  cancelAgreement,
  checkinAgreement,
  checkoutAgreement,
  createAgreement,
  extendAgreement,
  getAgreement,
  getAvailability,
  getCalendar,
  listAgreements,
  reassignAgreement,
  swapAgreement,
  updateAgreement,
} from '../api';

/**
 * Claves de react-query de las rentas (096). Son contrato con la 098, que
 * invalida `['rental-agreement', id]` y `['rental-agreements']` tras cobrar.
 */
export const AGREEMENTS_KEY = 'rental-agreements';
export const AGREEMENT_KEY = 'rental-agreement';
export const CALENDAR_KEY = 'rental-calendar';
export const AVAILABILITY_KEY = 'rental-availability';

export function useAgreements(
  filters: AgreementsQuery = {},
  enabled = true,
): UseQueryResult<RentalAgreement[], ApiError> {
  return useQuery<RentalAgreement[], ApiError>({
    queryKey: [AGREEMENTS_KEY, filters],
    queryFn: () => listAgreements(filters),
    enabled,
  });
}

export function useAgreement(
  id: string,
  enabled = true,
): UseQueryResult<RentalAgreement, ApiError> {
  return useQuery<RentalAgreement, ApiError>({
    queryKey: [AGREEMENT_KEY, id],
    queryFn: () => getAgreement(id),
    enabled,
  });
}

export function useCalendar(
  from: string,
  to: string,
  enabled = true,
): UseQueryResult<CalendarRow[], ApiError> {
  return useQuery<CalendarRow[], ApiError>({
    queryKey: [CALENDAR_KEY, from, to],
    queryFn: () => getCalendar(from, to),
    enabled,
  });
}

/** `q` en `null` no pregunta: el rango todavía no está completo. */
export function useAvailability(
  q: AvailabilityQuery | null,
  enabled = true,
): UseQueryResult<AvailabilityRow[], ApiError> {
  return useQuery<AvailabilityRow[], ApiError>({
    queryKey: [AVAILABILITY_KEY, q],
    queryFn: () => getAvailability(q as AvailabilityQuery),
    enabled: enabled && q !== null,
  });
}

/**
 * Cualquier cambio en una renta mueve la lista, la ficha, el calendario, la
 * disponibilidad y el kilometraje del carro.
 */
function useInvalidateRentals() {
  const queryClient = useQueryClient();

  return () => {
    for (const key of [AGREEMENTS_KEY, AGREEMENT_KEY, CALENDAR_KEY, AVAILABILITY_KEY]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
    void queryClient.invalidateQueries({ queryKey: FLEET_QUERY_KEY });
  };
}

function useAgreementMutation<Variables, Result = RentalAgreement>(
  mutationFn: (variables: Variables) => Promise<Result>,
) {
  const invalidate = useInvalidateRentals();

  return useMutation<Result, ApiError, Variables>({ mutationFn, onSuccess: invalidate });
}

export const useCreateAgreement = () =>
  useAgreementMutation((input: CreateAgreementInput) => createAgreement(input));

export const useUpdateAgreement = () =>
  useAgreementMutation(({ id, input }: { id: string; input: UpdateAgreementInput }) =>
    updateAgreement(id, input),
  );

export const useCheckoutAgreement = () =>
  useAgreementMutation(({ id, input }: { id: string; input: CheckoutInput }) =>
    checkoutAgreement(id, input),
  );

export const useCheckinAgreement = () =>
  useAgreementMutation(({ id, input }: { id: string; input: CheckinInput }) =>
    checkinAgreement(id, input),
  );

export const useExtendAgreement = () =>
  useAgreementMutation(({ id, input }: { id: string; input: ExtendInput }) =>
    extendAgreement(id, input),
  );

export const useReassignAgreement = () =>
  useAgreementMutation(({ id, input }: { id: string; input: ReassignInput }) =>
    reassignAgreement(id, input),
  );

export const useCancelAgreement = () =>
  useAgreementMutation(({ id, input }: { id: string; input: CancelInput }) =>
    cancelAgreement(id, input),
  );

export const useSwapAgreement = () =>
  useAgreementMutation<{ id: string; input: SwapInput }, AgreementSwapResult>(({ id, input }) =>
    swapAgreement(id, input),
  );

export const useAssignContractNumber = () =>
  useAgreementMutation((id: string) => assignContractNumber(id));
