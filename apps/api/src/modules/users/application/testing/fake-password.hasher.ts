import type { PasswordHasher } from '../ports/password.hasher';

/**
 * Hasher de mentira para los tests: bcrypt con factor 12 tarda a propósito, y
 * lo que se verifica acá es que la contraseña se hashea y nunca se devuelve en
 * claro, no el algoritmo. El bcrypt de verdad vive en `infrastructure/`.
 */
export class FakePasswordHasher implements PasswordHasher {
  hash(plainPassword: string): Promise<string> {
    return Promise.resolve(`hashed:${plainPassword}`);
  }
}
