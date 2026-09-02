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

/** Nombre de la cookie httpOnly que transporta el JWT de oficina (RN-8). */
export const SESSION_COOKIE_NAME = 'elite_session';

/**
 * Cookie de la vista pista, distinta de la de oficina (spec 003, RN-19). Las
 * dos conviven en el mismo navegador y cada vista mira la suya: un login de
 * pista no pisa la sesion de oficina, ni al reves.
 */
export const FLOOR_SESSION_COOKIE_NAME = 'elite_floor_session';

/**
 * De que mundo es una sesion (spec 003, RN-0). No es un rol: es el sujeto.
 *
 * - `user`: entra con correo y contrasena, ve la oficina, se autoriza por
 *   claves `module.action`.
 * - `employee`: entra con usuario y PIN, ve la pista, no tiene permisos.
 */
export type SessionKind = 'user' | 'employee';

/** Lo que el JWT lleva firmado. Deliberadamente minimo. */
export interface SessionTokenPayload {
  /** Id del sujeto: usuario u empleado, segun `kind`. */
  sub: string;
  /**
   * De que mundo es el token (RN-19). Las dos cookies se firman con el mismo
   * `JWT_SECRET`, asi que sin este claim un token de pista pegado en la cookie
   * de oficina pasa la verificacion de firma y solo lo frena que los ids no
   * colisionen. Eso es suerte, no una defensa.
   *
   * Opcional porque los tokens de oficina emitidos antes de que existiera este
   * claim siguen valiendo hasta que expiran: se tratan como `user` para no
   * cortarle la jornada a nadie al desplegar. Esa tolerancia se quita pasada
   * una jornada de 8 horas (ver spec 003 -> Revision previa).
   */
  kind?: SessionKind;
  /** Emitido en (segundos desde epoch), lo que firma el estandar JWT. */
  iat: number;
  /**
   * Emitido en, con milisegundos. Claim propio: `iat` solo tiene resolucion de
   * segundos y RN-10 necesita ordenar el token contra `passwordChangedAt`, que
   * si tiene milisegundos. Opcional porque los tokens emitidos antes de que
   * existiera este claim siguen siendo validos hasta que expiren.
   */
  iatMs?: number;
  /** Expira en (segundos desde epoch). */
  exp: number;
}

/** Clave con la que el guard de pista deja al empleado en el request. */
export const REQUEST_EMPLOYEE_KEY = 'floorEmployee';

/**
 * El empleado que resolvio el guard de pista. Deliberadamente pobre: no lleva
 * permisos porque no los tiene (RN-0). Si aparece un `permissions` aca, algo se
 * entendio al reves.
 */
export interface AuthenticatedEmployee {
  id: string;
  username: string;
  fullName: string;
}
