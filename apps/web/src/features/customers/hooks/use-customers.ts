'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  CreateCustomerInput,
  CreateVehicleInput,
  Customer,
  Page,
  UpdateCustomerInput,
  UpdateVehicleInput,
  VehicleWithOwner,
} from '@elite/shared';

import type { ApiError } from '@/lib/api';
import { LIST_PAGE_SIZE } from '@/lib/list-params';
import {
  createCustomer,
  createVehicle,
  getCustomer,
  listCustomerVehiclesPage,
  listCustomersPage,
  updateCustomer,
  updateVehicle,
} from '../api';

export const CUSTOMERS_QUERY_KEY = ['customers'] as const;

/** Una página de clientes (102). `pageSize: 1` sirve para contar todos. */
export function useCustomers(
  params: { q?: string; page?: number; pageSize?: number } = {},
  enabled = true,
): UseQueryResult<Page<Customer>, ApiError> {
  const request = { pageSize: LIST_PAGE_SIZE, ...params };

  return useQuery<Page<Customer>, ApiError>({
    queryKey: [...CUSTOMERS_QUERY_KEY, 'list', request],
    queryFn: () => listCustomersPage(request),
    placeholderData: keepPreviousData,
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

/** Una página de los carros del cliente, para su ficha (102). */
export function useCustomerVehicles(
  customerId: string,
  page = 1,
  enabled = true,
): UseQueryResult<Page<VehicleWithOwner>, ApiError> {
  return useQuery<Page<VehicleWithOwner>, ApiError>({
    queryKey: [...CUSTOMERS_QUERY_KEY, customerId, 'vehicles', page],
    queryFn: () => listCustomerVehiclesPage(customerId, { page, pageSize: LIST_PAGE_SIZE }),
    placeholderData: keepPreviousData,
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

export function useCreateVehicle() {
  const invalidate = useCustomersInvalidation();

  return useMutation<VehicleWithOwner, ApiError, CreateVehicleInput>({
    mutationFn: createVehicle,
    onSuccess: invalidate,
  });
}

export function useUpdateVehicle() {
  const invalidate = useCustomersInvalidation();

  return useMutation<VehicleWithOwner, ApiError, { id: string; input: UpdateVehicleInput }>({
    mutationFn: ({ id, input }) => updateVehicle(id, input),
    onSuccess: invalidate,
  });
}
