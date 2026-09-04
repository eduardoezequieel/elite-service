import { compare, hash } from 'bcryptjs';

import type { PinHasher } from '../application/ports/pin.hasher';

/** Mismo costo que las contrasenas de oficina (RN-18). */
const BCRYPT_COST_FACTOR = 12;

/**
 * El PIN son 4 a 8 digitos: el espacio de busqueda es chico y bcrypt con costo
 * 12 es lo que hace que probarlo a la fuerza cueste. Bajarlo aca porque "es
 * solo un PIN" seria justo al reves de lo que corresponde.
 */
export class BcryptPinHasher implements PinHasher {
  hash(pin: string): Promise<string> {
    return hash(pin, BCRYPT_COST_FACTOR);
  }

  verify(pin: string, pinHash: string): Promise<boolean> {
    return compare(pin, pinHash);
  }
}
