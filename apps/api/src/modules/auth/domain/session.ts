/**
 * Reglas puras de la sesion. Sin NestJS, sin ORM.
 */

/** Duracion del JWT: una jornada laboral (RN-8). Sin refresh tokens en v1. */
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

/**
 * `true` si el token se emitio ANTES del ultimo cambio de contrasena (RN-10):
 * reemplazar una contrasena invalida las sesiones abiertas de ese usuario.
 *
 * Se compara con la mejor precision que traiga el token:
 *
 * - **Con `issuedAtMillis`** (claim `iatMs`, lo llevan todos los tokens que
 *   emite el sistema) la comparacion es exacta contra `passwordChangedAt`. Sin
 *   ventanas: ni una sesion revocada que sobreviva, ni un login recien hecho
 *   que se caiga.
 * - **Sin el** solo queda `iat`, en segundos enteros, y dentro de un mismo
 *   segundo no hay con que ordenar los hechos. Ahi se conserva el `<` de
 *   siempre, que falla del lado de dejar pasar. Es el camino de los tokens
 *   emitidos antes de que existiera `iatMs`, y se apaga solo cuando expiran.
 *
 * Por que hace falta `iatMs`: `passwordChangedAt` se escribe tanto al crear un
 * usuario como al reemplazar su contrasena, asi que con resolucion de segundos
 * un usuario recien creado que inicia sesion en ese mismo segundo es
 * indistinguible de una sesion vieja que hay que revocar. Con `<` sobrevivia
 * una sesion revocada; con `<=` se caia el login legitimo. El dato faltaba.
 */
export function isTokenIssuedBeforePasswordChange(
  issuedAtSeconds: number,
  passwordChangedAt: Date,
  issuedAtMillis?: number,
): boolean {
  if (issuedAtMillis !== undefined) {
    return issuedAtMillis < passwordChangedAt.getTime();
  }

  return issuedAtSeconds < Math.floor(passwordChangedAt.getTime() / 1000);
}
