import type { PublicEmployee } from '@elite/shared';

import type { Employee } from '../domain/employee';

/**
 * Traduce la entidad al contrato publico. El unico lugar donde se decide que
 * sale del API: `pinHash` y `pinChangedAt` no cruzan nunca (RN-18).
 */
export function toPublicEmployee(employee: Employee): PublicEmployee {
  return {
    id: employee.id,
    username: employee.username,
    fullName: employee.fullName,
    isActive: employee.isActive,
    createdAt: employee.createdAt.toISOString(),
    updatedAt: employee.updatedAt.toISOString(),
  };
}
