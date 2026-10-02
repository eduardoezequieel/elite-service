import type { CreateEmployeeInput, Page, PublicEmployee, UpdateEmployeeInput } from '@elite/shared';

import { listQuery } from '@/features/inventory/list-query';
import { apiFetch } from '@/lib/api';

/** API de empleados, desde la oficina. El PIN nunca vuelve (RN-18). */

export interface EmployeesParams {
  /** Nombre o usuario. */
  search?: string;
  /** `true` solo activos, `false` solo inactivos, sin él todos. */
  active?: boolean;
  page?: number;
  pageSize?: number;
}

/** `GET /employees`, de a una página (spec 102). */
export function listEmployees(params: EmployeesParams = {}): Promise<Page<PublicEmployee>> {
  return apiFetch<Page<PublicEmployee>>(
    `/employees${listQuery({
      search: params.search,
      active: params.active,
      page: params.page,
      pageSize: params.pageSize,
    })}`,
  );
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
