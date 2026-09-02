'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type { CreateEmployeeInput, PublicEmployee, UpdateEmployeeInput } from '@elite/shared';

import type { ApiError } from '@/lib/api';
import { createEmployee, listEmployees, updateEmployee } from '../api';

export const EMPLOYEES_QUERY_KEY = ['employees'] as const;

export function useEmployees(enabled = true): UseQueryResult<PublicEmployee[], ApiError> {
  return useQuery<PublicEmployee[], ApiError>({
    queryKey: EMPLOYEES_QUERY_KEY,
    queryFn: listEmployees,
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
