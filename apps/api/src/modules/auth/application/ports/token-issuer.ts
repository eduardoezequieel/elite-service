import type { SessionTokenPayload } from '../../../../common/auth/authenticated-user';

/** Un token recien emitido, con lo que la cookie necesita saber (RN-8). */
export interface IssuedToken {
  token: string;
  expiresInSeconds: number;
}

/**
 * Puerto de emision y verificacion del JWT de sesion. El token lleva solo
 * `sub`, `iat` y `exp`: ni roles ni permisos (RN-6b).
 */
export interface TokenIssuer {
  issue(userId: string): Promise<IssuedToken>;
  /** Devuelve el payload si la firma y la expiracion son validas; `null` si no. */
  verify(token: string): Promise<SessionTokenPayload | null>;
}

/** Token de inyeccion del puerto. */
export const TOKEN_ISSUER = 'auth:TokenIssuer';
