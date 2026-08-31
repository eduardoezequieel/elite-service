import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';

import { SESSION_COOKIE_NAME } from '../../../common/auth/authenticated-user';

/**
 * Escribe y limpia la cookie de sesion (RN-8): `httpOnly` + `SameSite=Lax`,
 * y `secure` solo en produccion, porque en desarrollo el API no corre sobre
 * HTTPS y el navegador descartaria la cookie.
 */
@Injectable()
export class SessionCookieService {
  private readonly secure: boolean;

  constructor(config: ConfigService) {
    this.secure = config.get<string>('NODE_ENV') === 'production';
  }

  set(response: Response, token: string, maxAgeSeconds: number): void {
    response.cookie(SESSION_COOKIE_NAME, token, {
      ...this.baseOptions(),
      maxAge: maxAgeSeconds * 1000,
    });
  }

  /** Cookie vacia y ya expirada: el navegador la descarta en el acto. */
  clear(response: Response): void {
    response.cookie(SESSION_COOKIE_NAME, '', {
      ...this.baseOptions(),
      maxAge: 0,
      expires: new Date(0),
    });
  }

  private baseOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.secure,
      path: '/',
    };
  }
}
