/**
 * Deja escrito quien autorizo la accion destructiva (045 RN-5). Va el nombre,
 * nunca el correo ni nada de la contrasena.
 *
 * `null` solo aparece en llamadas internas sin autorizacion (los tests y las
 * transiciones que no la piden): ahi la nota queda como estaba.
 */
export function signed(note: string, authorizedBy: string | null): string {
  return authorizedBy === null ? note : `${note} (autorizó: ${authorizedBy})`;
}
