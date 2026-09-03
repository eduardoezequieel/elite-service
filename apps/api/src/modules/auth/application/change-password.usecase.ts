import { API_ERROR_CODES, type ChangePasswordInput } from '@elite/shared';
import { UnauthorizedException } from '@nestjs/common';

import type { AuthUserRepository } from './ports/auth-user.repository';
import type { PasswordHasher } from './ports/password-hasher';
import type { IssuedToken, TokenIssuer } from './ports/token-issuer';

const SESSION_INVALID_MESSAGE = 'Tu sesión no es válida. Iniciá sesión de nuevo.';
const WRONG_CURRENT_MESSAGE = 'La contraseña actual no es correcta.';

/**
 * Caso de uso de `POST /auth/password` (spec 006).
 *
 * Verifica la actual, escribe el hash nuevo y la marca, y devuelve un JWT
 * emitido **después** de la marca para que esta sesión siga (RN-7). Las
 * demás mueren por spec 001 RN-10.
 */
export class ChangePasswordUseCase {
  constructor(
    private readonly users: AuthUserRepository,
    private readonly passwords: PasswordHasher,
    private readonly tokens: TokenIssuer,
  ) {}

  async execute(userId: string, input: ChangePasswordInput): Promise<IssuedToken> {
    const user = await this.users.findById(userId);

    if (user === null || !user.isActive) {
      throw new UnauthorizedException({
        code: API_ERROR_CODES.UNAUTHORIZED,
        message: SESSION_INVALID_MESSAGE,
      });
    }

    const currentMatches = await this.passwords.verify(input.currentPassword, user.passwordHash);

    if (!currentMatches) {
      throw new UnauthorizedException({
        code: API_ERROR_CODES.INVALID_CREDENTIALS,
        message: WRONG_CURRENT_MESSAGE,
      });
    }

    const passwordHash = await this.passwords.hash(input.newPassword);
    const passwordChangedAt = new Date();

    await this.users.updatePassword(user.id, passwordHash, passwordChangedAt);

    return this.tokens.issue(user.id);
  }
}
