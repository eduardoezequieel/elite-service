import { Injectable } from '@nestjs/common';
import { hash } from 'bcryptjs';

import type { PasswordHasher } from '../application/ports/password.hasher';

/** Factor de bcrypt (RN-7). El mismo que usa el seed. */
const BCRYPT_ROUNDS = 12;

/**
 * Implementación real del puerto de hasheo. Vive en `infrastructure/` porque
 * bcrypt es una dependencia externa: los casos de uso sólo conocen la interfaz.
 */
@Injectable()
export class BcryptPasswordHasher implements PasswordHasher {
  hash(plainPassword: string): Promise<string> {
    return hash(plainPassword, BCRYPT_ROUNDS);
  }
}
