/**
 * Reglas puras de la sesion. Sin NestJS, sin ORM.
 */

/** Duracion del JWT: una jornada laboral (RN-8). Sin refresh tokens en v1. */
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

/**
 * `true` si el token se emitio ANTES del ultimo cambio de contrasena (RN-10):
 * reemplazar una contrasena invalida las sesiones abiertas de ese usuario.
 *
 * Ojo con las unidades: `iat` viaja en SEGUNDOS enteros y `passwordChangedAt`
 * es un `DateTime` con milisegundos. Por eso la fecha se trunca a segundos
 * antes de comparar; si no, un token emitido en el mismo segundo del cambio se
 * rechazaria por una diferencia de milisegundos que el JWT ni siquiera guarda.
 */
export function isTokenIssuedBeforePasswordChange(
  issuedAtSeconds: number,
  passwordChangedAt: Date,
): boolean {
  return issuedAtSeconds < Math.floor(passwordChangedAt.getTime() / 1000);
}
