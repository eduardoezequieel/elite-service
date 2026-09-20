import { createHmac } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { PinDigest } from '../application/ports/pin-digest';

/**
 * HMAC-SHA256 del PIN con `PIN_PEPPER`, en hexadecimal (044 RN-4).
 *
 * El pepper vive solo en el entorno, nunca en la base: quien se lleve un
 * volcado se lleva 64 caracteres que no dicen nada. Cambiarlo invalida todos
 * los PINs a la vez, asi que se rota igual que `JWT_SECRET`: a proposito y
 * reasignando PINs despues.
 */
@Injectable()
export class HmacPinDigest implements PinDigest {
  private readonly pepper: string;

  constructor(config: ConfigService) {
    this.pepper = config.getOrThrow<string>('PIN_PEPPER');
  }

  digest(pin: string): string {
    return createHmac('sha256', this.pepper).update(pin).digest('hex');
  }
}
