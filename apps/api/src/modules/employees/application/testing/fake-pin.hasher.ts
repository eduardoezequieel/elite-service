import type { PinHasher } from '../ports/pin.hasher';

/**
 * Hasher de mentira para los tests: prefija en vez de hashear, asi el caso de
 * uso se prueba sin pagar los ~100ms de bcrypt por intento.
 */
export class FakePinHasher implements PinHasher {
  async hash(pin: string): Promise<string> {
    return `hashed:${pin}`;
  }

  async verify(pin: string, hash: string): Promise<boolean> {
    return hash === `hashed:${pin}`;
  }
}
