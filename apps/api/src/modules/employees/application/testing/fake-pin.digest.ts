import type { PinDigest } from '../ports/pin-digest';

/**
 * Digest de mentira para los tests: prefija en vez de cifrar, asi el caso de
 * uso se prueba sin depender de `PIN_PEPPER`.
 */
export class FakePinDigest implements PinDigest {
  digest(pin: string): string {
    return `digest:${pin}`;
  }
}
