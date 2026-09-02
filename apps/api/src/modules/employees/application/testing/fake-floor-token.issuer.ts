import type { SessionTokenPayload } from '../../../../common/auth/authenticated-user';
import type { FloorTokenIssuer, IssuedFloorToken } from '../ports/floor-token-issuer';

/** Emisor de mentira: el token es el id del empleado, sin firmar nada. */
export class FakeFloorTokenIssuer implements FloorTokenIssuer {
  readonly issued: string[] = [];

  async issue(employeeId: string): Promise<IssuedFloorToken> {
    this.issued.push(employeeId);

    return { token: `floor-token:${employeeId}`, expiresInSeconds: 28_800 };
  }

  async verify(token: string): Promise<SessionTokenPayload | null> {
    const prefix = 'floor-token:';

    if (!token.startsWith(prefix)) return null;

    const now = Math.floor(Date.now() / 1000);

    return {
      sub: token.slice(prefix.length),
      iat: now,
      iatMs: Date.now(),
      exp: now + 28_800,
      kind: 'employee',
    };
  }
}
