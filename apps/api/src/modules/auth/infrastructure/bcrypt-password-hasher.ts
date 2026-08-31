import { compare, hash } from 'bcryptjs';

import type { PasswordHasher } from '../application/ports/password-hasher';

/** Factor de costo de bcrypt (RN-7). */
const BCRYPT_COST_FACTOR = 12;

/** Implementacion del puerto con `bcryptjs`. */
export class BcryptPasswordHasher implements PasswordHasher {
  hash(plainPassword: string): Promise<string> {
    return hash(plainPassword, BCRYPT_COST_FACTOR);
  }

  verify(plainPassword: string, passwordHash: string): Promise<boolean> {
    return compare(plainPassword, passwordHash);
  }
}
