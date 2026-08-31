/**
 * Puerto de hasheo de contraseñas.
 *
 * Sólo hashea: verificar credenciales es asunto del módulo `auth`. La
 * implementación real (bcrypt, factor 12 — RN-7) vive en `infrastructure/`,
 * de modo que los tests corren sin pagar el costo de bcrypt.
 */
export interface PasswordHasher {
  hash(plainPassword: string): Promise<string>;
}
