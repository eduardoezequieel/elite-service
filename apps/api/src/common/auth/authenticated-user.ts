/**
 * El usuario que resolvio el guard para este request.
 *
 * Los permisos se resuelven contra la base en CADA request, no salen del JWT
 * (RN-6b): un cambio de rol o de permisos aplica en el request siguiente, sin
 * volver a iniciar sesion. El costo esta declarado en RN-6c.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  /** Ids y nombres de los roles asignados. El nombre es dato, nunca logica. */
  roles: { id: string; name: string }[];
  /** Union de los permisos de todos sus roles (RN-3). */
  permissions: string[];
}

/** Clave con la que el guard deja al usuario en el request de Express. */
export const REQUEST_USER_KEY = 'authenticatedUser';

/** Nombre de la cookie httpOnly que transporta el JWT (RN-8). */
export const SESSION_COOKIE_NAME = 'elite_session';

/** Lo que el JWT lleva firmado. Deliberadamente minimo. */
export interface SessionTokenPayload {
  /** Id del usuario. */
  sub: string;
  /** Emitido en (segundos desde epoch). Se compara con `passwordChangedAt` (RN-10). */
  iat: number;
  /** Expira en (segundos desde epoch). */
  exp: number;
}
