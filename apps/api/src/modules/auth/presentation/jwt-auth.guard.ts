import { API_ERROR_CODES } from '@elite/shared';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { IS_PUBLIC_KEY } from '../../../common/auth/auth.decorators';
import { REQUEST_USER_KEY, SESSION_COOKIE_NAME } from '../../../common/auth/authenticated-user';
import { toAuthenticatedUser } from '../application/auth-user.mapper';
import { AUTH_USER_REPOSITORY } from '../application/ports/auth-user.repository';
import type { AuthUserRepository } from '../application/ports/auth-user.repository';
import { TOKEN_ISSUER } from '../application/ports/token-issuer';
import type { TokenIssuer } from '../application/ports/token-issuer';
import { isTokenIssuedBeforePasswordChange } from '../domain/session';

/** Un solo mensaje para todos los motivos: no se le explica al atacante. */
const SESSION_INVALID_MESSAGE = 'Tu sesión no es válida. Iniciá sesión de nuevo.';

/**
 * Guard global de sesion. Se registra como `APP_GUARD` en `app.module.ts` y
 * corre ANTES de `PermissionsGuard`.
 *
 * Para cada request no publico: lee la cookie, verifica el JWT, carga al
 * usuario con sus roles y permisos desde la base (RN-6b), aplica RN-4 y RN-10,
 * y deja el `AuthenticatedUser` en el request.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH_USER_REPOSITORY) private readonly users: AuthUserRepository,
    @Inject(TOKEN_ISSUER) private readonly tokens: TokenIssuer,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublic(context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.readToken(request);

    if (token === undefined) {
      throw unauthorized();
    }

    const payload = await this.tokens.verify(token);

    if (payload === null) {
      throw unauthorized();
    }

    const user = await this.users.findById(payload.sub);

    // RN-4: un usuario desactivado pierde sus sesiones abiertas, aunque su JWT
    // siga siendo valido.
    if (user === null || !user.isActive) {
      throw unauthorized();
    }

    // RN-10: todo JWT emitido antes del ultimo cambio de contrasena se rechaza.
    if (isTokenIssuedBeforePasswordChange(payload.iat, user.passwordChangedAt)) {
      throw unauthorized();
    }

    const requestBag = request as unknown as Record<string, unknown>;

    requestBag[REQUEST_USER_KEY] = toAuthenticatedUser(user);

    return true;
  }

  private isPublic(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }

  private readToken(request: Request): string | undefined {
    const cookies = request.cookies as Record<string, unknown> | undefined;
    const value = cookies?.[SESSION_COOKIE_NAME];

    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }
}

function unauthorized(): UnauthorizedException {
  return new UnauthorizedException({
    code: API_ERROR_CODES.UNAUTHORIZED,
    message: SESSION_INVALID_MESSAGE,
  });
}
