import type { SessionTokenPayload } from '../../../../common/auth/authenticated-user';

/** Token de sesion de pista, con su vida util para armar la cookie. */
export interface IssuedFloorToken {
  token: string;
  expiresInSeconds: number;
}

/**
 * Puerto de emision del JWT de pista. Firma con el mismo `JWT_SECRET` que el de
 * oficina, asi que el token DEBE llevar `kind: "employee"`: es lo unico que
 * impide que sirva en la otra vista (RN-19).
 */
export interface FloorTokenIssuer {
  issue(employeeId: string): Promise<IssuedFloorToken>;
  /** `null` si la firma no cierra, expiro, o no es un token de pista. */
  verify(token: string): Promise<SessionTokenPayload | null>;
}

export const FLOOR_TOKEN_ISSUER = Symbol('employees.FloorTokenIssuer');
