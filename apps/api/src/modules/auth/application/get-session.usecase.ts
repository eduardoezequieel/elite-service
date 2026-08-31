import { API_ERROR_CODES } from '@elite/shared';
import type { SessionResponse } from '@elite/shared';
import { UnauthorizedException } from '@nestjs/common';

import { effectivePermissions } from '../domain/auth-user';
import { toPublicUser, toRoleSummaries } from './auth-user.mapper';
import type { AuthUserRepository } from './ports/auth-user.repository';

/** Mensaje unico de sesion invalida. */
const SESSION_INVALID_MESSAGE = 'Tu sesión no es válida. Iniciá sesión de nuevo.';

/**
 * Caso de uso de `GET /auth/me`. Vuelve a leer al usuario para devolver sus
 * datos completos y sus permisos recien resueltos contra la base (RN-6b).
 */
export class GetSessionUseCase {
  constructor(private readonly users: AuthUserRepository) {}

  async execute(userId: string): Promise<SessionResponse> {
    const user = await this.users.findById(userId);

    if (user === null || !user.isActive) {
      throw new UnauthorizedException({
        code: API_ERROR_CODES.UNAUTHORIZED,
        message: SESSION_INVALID_MESSAGE,
      });
    }

    return {
      user: toPublicUser(user),
      roles: toRoleSummaries(user),
      permissions: effectivePermissions(user),
    };
  }
}
