import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import type { SessionKind, SessionTokenPayload } from '../../../common/auth/authenticated-user';
import type { FloorTokenIssuer, IssuedFloorToken } from '../application/ports/floor-token-issuer';

/** Una jornada, igual que la sesion de oficina (RN-19). */
export const FLOOR_SESSION_TTL_SECONDS = 8 * 60 * 60;

/**
 * Emisor del JWT de pista. Comparte `JwtService` —y por lo tanto el secreto—
 * con el de oficina, asi que `kind: 'employee'` no es decorativo: es lo unico
 * que impide que este token sirva en la otra vista (RN-19).
 *
 * `verify` ademas **exige** ese `kind`. Un token de oficina metido en la cookie
 * de pista tiene firma valida; sin este chequeo entraria.
 */
@Injectable()
export class JwtFloorTokenIssuer implements FloorTokenIssuer {
  constructor(private readonly jwt: JwtService) {}

  async issue(employeeId: string): Promise<IssuedFloorToken> {
    const token = await this.jwt.signAsync(
      { iatMs: Date.now(), kind: 'employee' satisfies SessionKind },
      { subject: employeeId, expiresIn: FLOOR_SESSION_TTL_SECONDS },
    );

    return { token, expiresInSeconds: FLOOR_SESSION_TTL_SECONDS };
  }

  async verify(token: string): Promise<SessionTokenPayload | null> {
    try {
      const payload = await this.jwt.verifyAsync<Record<string, unknown>>(token);

      return isFloorTokenPayload(payload) ? payload : null;
    } catch {
      return null;
    }
  }
}

/**
 * A diferencia del de oficina, aca `kind` es **obligatorio**: no hay tokens de
 * pista anteriores al claim, porque la pista nace con el.
 */
function isFloorTokenPayload(
  payload: Record<string, unknown>,
): payload is SessionTokenPayload & Record<string, unknown> {
  return (
    typeof payload.sub === 'string' &&
    typeof payload.iat === 'number' &&
    typeof payload.exp === 'number' &&
    payload.kind === 'employee' &&
    (payload.iatMs === undefined || typeof payload.iatMs === 'number')
  );
}
