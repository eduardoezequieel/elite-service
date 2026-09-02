import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';

import { FLOOR_SESSION_COOKIE_NAME } from '../../../common/auth/authenticated-user';

/**
 * Escribe y limpia la cookie de pista (RN-19).
 *
 * Es una cookie distinta de la de oficina, con el mismo `path`, asi que las dos
 * conviven en el navegador de la tablet del mostrador sin pisarse: entrar a la
 * pista no cierra la sesion de oficina, ni al reves.
 */
@Injectable()
export class FloorCookieService {
  private readonly secure: boolean;

  constructor(config: ConfigService) {
    this.secure = config.get<string>('NODE_ENV') === 'production';
  }

  set(response: Response, token: string, maxAgeSeconds: number): void {
    response.cookie(FLOOR_SESSION_COOKIE_NAME, token, {
      ...this.baseOptions(),
      maxAge: maxAgeSeconds * 1000,
    });
  }

  clear(response: Response): void {
    response.cookie(FLOOR_SESSION_COOKIE_NAME, '', {
      ...this.baseOptions(),
      maxAge: 0,
      expires: new Date(0),
    });
  }

  private baseOptions(): CookieOptions {
    return { httpOnly: true, sameSite: 'lax', secure: this.secure, path: '/' };
  }
}
