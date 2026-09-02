import type { CreateEmployeeInput, PublicEmployee, UpdateEmployeeInput } from '@elite/shared';

import { apiFetch } from '@/lib/api';

/** API de empleados, desde la oficina. El PIN nunca vuelve (RN-18). */

export function listEmployees(): Promise<PublicEmployee[]> {
  return apiFetch<PublicEmployee[]>('/employees');
}

export function createEmployee(input: CreateEmployeeInput): Promise<PublicEmployee> {
  return apiFetch<PublicEmployee>('/employees', { method: 'POST', body: JSON.stringify(input) });
}

/** Reemplazar el PIN cierra las sesiones de pista de ese empleado (RN-18). */
export function updateEmployee(id: string, input: UpdateEmployeeInput): Promise<PublicEmployee> {
  return apiFetch<PublicEmployee>(`/employees/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
