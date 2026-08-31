/**
 * Puerto de hasheo de contrasenas (RN-7). La implementacion concreta usa
 * bcrypt con factor 12 y vive en `infrastructure/`.
 */
export interface PasswordHasher {
  hash(plainPassword: string): Promise<string>;
  verify(plainPassword: string, passwordHash: string): Promise<boolean>;
}

/** Token de inyeccion del puerto. */
export const PASSWORD_HASHER = 'auth:PasswordHasher';
