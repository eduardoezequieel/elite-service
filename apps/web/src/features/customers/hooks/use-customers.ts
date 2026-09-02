'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type {
  CreateCustomerInput,
  Customer,
  UpdateCustomerInput,
  VehicleWithOwner,
} from '@elite/shared';

import type { ApiError } from '@/lib/api';
import {
  createCustomer,
  getCustomer,
  listCustomerVehicles,
  listCustomers,
  updateCustomer,
} from '../api';

export const CUSTOMERS_QUERY_KEY = ['customers'] as const;

export function useCustomers(
  params: { q?: string; activeOnly?: boolean } = {},
  enabled = true,
): UseQueryResult<Customer[], ApiError> {
  return useQuery<Customer[], ApiError>({
    queryKey: [...CUSTOMERS_QUERY_KEY, 'list', params],
    queryFn: () => listCustomers(params),
    enabled,
  });
}

export function useCustomer(id: string, enabled = true): UseQueryResult<Customer, ApiError> {
  return useQuery<Customer, ApiError>({
    queryKey: [...CUSTOMERS_QUERY_KEY, id],
    queryFn: () => getCustomer(id),
    enabled,
  });
}

export function useCustomerVehicles(
  customerId: string,
  enabled = true,
): UseQueryResult<VehicleWithOwner[], ApiError> {
  return useQuery<VehicleWithOwner[], ApiError>({
    queryKey: [...CUSTOMERS_QUERY_KEY, customerId, 'vehicles'],
    queryFn: () => listCustomerVehicles(customerId),
    enabled,
  });
}

/**
 * Crear o corregir un cliente invalida **toda** la rama de clientes: la lista,
 * la ficha y las sugerencias del alta de un lavado leen el mismo nombre y el
 * mismo teléfono, y quedarse con la copia vieja mostraría el dato que se acaba
 * de corregir.
 */
function useCustomersInvalidation() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ['customer-search'] });
  };
}

export function useCreateCustomer() {
  const invalidate = useCustomersInvalidation();

  return useMutation<Customer, ApiError, CreateCustomerInput>({
    mutationFn: createCustomer,
    onSuccess: invalidate,
  });
}

export function useUpdateCustomer() {
  const invalidate = useCustomersInvalidation();

  return useMutation<Customer, ApiError, { id: string; input: UpdateCustomerInput }>({
    mutationFn: ({ id, input }) => updateCustomer(id, input),
    onSuccess: invalidate,
  });
}
