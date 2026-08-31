import type { PublicUser } from '@elite/shared';

import type { User } from '../domain/user';

/**
 * Traduce la entidad de dominio al contrato del API (`PublicUser` de
 * `@elite/shared`). Las fechas viajan como ISO 8601, porque JSON no tiene
 * fechas.
 *
 * `passwordHash` no puede escaparse por acá: no existe en la entidad de
 * dominio (RN-7).
 */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    isActive: user.isActive,
    roles: user.roles.map((role) => ({ id: role.id, name: role.name })),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
