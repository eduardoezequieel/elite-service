'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { MAX_PAGE_SIZE } from '@elite/shared';
import type { CreateEmployeeInput, Page, PublicEmployee, UpdateEmployeeInput } from '@elite/shared';

import type { ApiError } from '@/lib/api';
import { createEmployee, listEmployees, updateEmployee, type EmployeesParams } from '../api';

export const EMPLOYEES_QUERY_KEY = ['employees'] as const;

/**
 * Los empleados como opciones de un selector (Rendimiento, Movimientos): la
 * primera página con el tope del API, ya como lista.
 */
export function useEmployees(enabled = true): UseQueryResult<PublicEmployee[], ApiError> {
  return useQuery<Page<PublicEmployee>, ApiError, PublicEmployee[]>({
    queryKey: [...EMPLOYEES_QUERY_KEY, 'options'],
    queryFn: () => listEmployees({ pageSize: MAX_PAGE_SIZE }),
    select: (page) => page.items,
    enabled,
  });
}

/** Una página de la lista de Empleados (spec 102). */
export function useEmployeesPage(
  params: EmployeesParams,
  enabled = true,
): UseQueryResult<Page<PublicEmployee>, ApiError> {
  return useQuery<Page<PublicEmployee>, ApiError>({
    queryKey: [...EMPLOYEES_QUERY_KEY, 'page', params],
    queryFn: () => listEmployees(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

function useEmployeesInvalidation() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: EMPLOYEES_QUERY_KEY });
  };
}

export function useCreateEmployee() {
  const invalidate = useEmployeesInvalidation();

  return useMutation<PublicEmployee, ApiError, CreateEmployeeInput>({
    mutationFn: createEmployee,
    onSuccess: invalidate,
  });
}

export function useUpdateEmployee() {
  const invalidate = useEmployeesInvalidation();

  return useMutation<PublicEmployee, ApiError, { id: string; input: UpdateEmployeeInput }>({
    mutationFn: ({ id, input }) => updateEmployee(id, input),
    onSuccess: invalidate,
  });
}
