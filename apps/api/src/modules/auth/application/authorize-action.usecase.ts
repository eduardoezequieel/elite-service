import { API_ERROR_CODES } from '@elite/shared';
import type { AuthorizationInput } from '@elite/shared';
import { ForbiddenException } from '@nestjs/common';

import type { ActionAuthorizer } from '../../../common/auth/authenticated-user';
import { effectivePermissions, hasAllPermissions } from '../domain/auth-user';
import type { AuthUserRepository } from './ports/auth-user.repository';
import type { PasswordHasher } from './ports/password-hasher';

/**
 * Mismo mensaje para contrasena incorrecta, usuario desactivado y usuario sin
 * el permiso: no se revela cual de los tres fallo (045 RN-2). Es el mismo
 * criterio del login.
 */
const NOT_AUTHORIZED_MESSAGE = 'Esas credenciales no autorizan esta acción.';

/**
 * Autoriza una accion destructiva con las credenciales de un tercero, escritas
 * en la pantalla del que esta adelante (spec 045).
 *
 * No abre sesion: no emite token ni toca la cookie (RN-4). Solo responde si esa
 * persona puede firmar la accion, y con que nombre queda firmada.
 *
 * El permiso se evalua contra claves `module.action`, nunca contra el nombre de
 * un rol (RN-1): "administrador" es quien tenga la clave, y eso se decide desde
 * la pantalla de roles, no en el codigo.
 */
export class AuthorizeActionUseCase {
  constructor(
    private readonly users: AuthUserRepository,
    private readonly passwords: PasswordHasher,
  ) {}

  async execute(input: AuthorizationInput, required: readonly string[]): Promise<ActionAuthorizer> {
    const user = await this.users.findByEmail(input.email);

    if (user === null) {
      throw this.notAuthorized();
    }

    const passwordMatches = await this.passwords.verify(input.password, user.passwordHash);

    if (!passwordMatches || !user.isActive) {
      throw this.notAuthorized();
    }

    if (!hasAllPermissions(effectivePermissions(user), required)) {
      throw this.notAuthorized();
    }

    return { id: user.id, fullName: user.fullName };
  }

  private notAuthorized(): ForbiddenException {
    // 403 y no 401: un 401 lo lee el frontend como sesion vencida y mandaria a
    // login al que esta adelante, que no hizo nada malo.
    return new ForbiddenException({
      code: API_ERROR_CODES.AUTHORIZATION_FAILED,
      message: NOT_AUTHORIZED_MESSAGE,
    });
  }
}
