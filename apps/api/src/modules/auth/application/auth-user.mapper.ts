import type { PublicUser, RoleSummary } from '@elite/shared';

import type { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { effectivePermissions } from '../domain/auth-user';
import type { AuthUser } from '../domain/auth-user';

/**
 * Traduce la entidad de dominio a las formas del contrato compartido.
 *
 * Ninguna de las tres incluye `passwordHash`: la contrasena no se devuelve ni
 * se loguea (RN-7).
 */

export function toRoleSummaries(user: AuthUser): RoleSummary[] {
  return user.roles.map((role) => ({ id: role.id, name: role.name }));
}

export function toPublicUser(user: AuthUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    isActive: user.isActive,
    roles: toRoleSummaries(user),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/** Lo que el guard deja en el request para el resto de los modulos. */
export function toAuthenticatedUser(user: AuthUser): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    roles: toRoleSummaries(user),
    permissions: effectivePermissions(user),
  };
}
