import { API_ERROR_CODES } from '@elite/shared';
import type { LoginInput, LoginResponse } from '@elite/shared';
import { UnauthorizedException } from '@nestjs/common';

import { effectivePermissions } from '../domain/auth-user';
import { toPublicUser } from './auth-user.mapper';
import type { AuthUserRepository } from './ports/auth-user.repository';
import type { PasswordHasher } from './ports/password-hasher';
import type { IssuedToken, TokenIssuer } from './ports/token-issuer';

/**
 * Mismo mensaje para credenciales invalidas y para usuario desactivado: no se
 * revela cual de los dos fallo.
 */
const INVALID_CREDENTIALS_MESSAGE = 'Correo o contraseña incorrectos.';

export interface LoginResult {
  /** Lo que viaja en el body de la respuesta. */
  session: LoginResponse;
  /** Lo que `presentation` escribe en la cookie httpOnly (RN-8). */
  token: IssuedToken;
}

/**
 * Caso de uso de inicio de sesion. Recibe sus dependencias como puertos por
 * constructor: no lleva decoradores de Nest y se prueba con implementaciones en
 * memoria (ver el `.spec`).
 */
export class LoginUseCase {
  constructor(
    private readonly users: AuthUserRepository,
    private readonly passwords: PasswordHasher,
    private readonly tokens: TokenIssuer,
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const user = await this.users.findByEmail(input.email);

    if (user === null) {
      throw this.invalidCredentials();
    }

    const passwordMatches = await this.passwords.verify(input.password, user.passwordHash);

    // Contrasena incorrecta y usuario desactivado (RN-4) salen por la misma
    // puerta y con el mismo texto.
    if (!passwordMatches || !user.isActive) {
      throw this.invalidCredentials();
    }

    return {
      session: {
        user: toPublicUser(user),
        permissions: effectivePermissions(user),
      },
      token: await this.tokens.issue(user.id),
    };
  }

  private invalidCredentials(): UnauthorizedException {
    return new UnauthorizedException({
      code: API_ERROR_CODES.INVALID_CREDENTIALS,
      message: INVALID_CREDENTIALS_MESSAGE,
    });
  }
}
