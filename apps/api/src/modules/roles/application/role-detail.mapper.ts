import type { RoleDetail } from '@elite/shared';

import type { Role } from '../domain/role';

/**
 * Traduce la entidad de dominio al contrato compartido que viaja por HTTP.
 * Las fechas salen en ISO 8601 porque JSON no tiene fechas.
 */
export function toRoleDetail(role: Role): RoleDetail {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    permissionKeys: role.permissionKeys,
    userCount: role.userCount,
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
  };
}
