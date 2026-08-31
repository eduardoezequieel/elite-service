import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import type { SessionTokenPayload } from '../../../common/auth/authenticated-user';
import type { IssuedToken, TokenIssuer } from '../application/ports/token-issuer';
import { SESSION_TTL_SECONDS } from '../domain/session';

/**
 * Implementacion del puerto con `@nestjs/jwt`. El secreto y la expiracion se
 * configuran en `auth.module.ts` a partir de `JWT_SECRET` (RN-8).
 */
@Injectable()
export class JwtTokenIssuer implements TokenIssuer {
  constructor(private readonly jwt: JwtService) {}

  async issue(userId: string): Promise<IssuedToken> {
    // El payload va vacio a proposito: el token lleva solo `sub`, `iat` y
    // `exp`. Roles y permisos se resuelven contra la base en cada request
    // (RN-6b), asi que congelarlos aca romperia la regla.
    const token = await this.jwt.signAsync({}, { subject: userId });

    return { token, expiresInSeconds: SESSION_TTL_SECONDS };
  }

  async verify(token: string): Promise<SessionTokenPayload | null> {
    try {
      const payload = await this.jwt.verifyAsync<Record<string, unknown>>(token);

      return isSessionTokenPayload(payload) ? payload : null;
    } catch {
      // Firma invalida, token expirado o basura: para el guard es lo mismo.
      return null;
    }
  }
}

function isSessionTokenPayload(
  payload: Record<string, unknown>,
): payload is SessionTokenPayload & Record<string, unknown> {
  return (
    typeof payload.sub === 'string' &&
    typeof payload.iat === 'number' &&
    typeof payload.exp === 'number'
  );
}
