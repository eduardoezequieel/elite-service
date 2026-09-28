import { Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { FLOOR_SESSION_KEY, IS_PUBLIC_KEY } from '../../../common/auth/auth.decorators';
import { REQUEST_USER_KEY, SESSION_COOKIE_NAME } from '../../../common/auth/authenticated-user';
import {
  attachSession,
  invalidSession,
  readSessionCookie,
} from '../../../common/auth/session-cookie';
import { toAuthenticatedUser } from '../application/auth-user.mapper';
import { AUTH_USER_REPOSITORY } from '../application/ports/auth-user.repository';
import type { AuthUserRepository } from '../application/ports/auth-user.repository';
import { TOKEN_ISSUER } from '../application/ports/token-issuer';
import type { TokenIssuer } from '../application/ports/token-issuer';
import { isTokenIssuedBeforePasswordChange } from '../domain/session';

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

    // Las rutas de pista las atiende `FloorAuthGuard`: tienen otra cookie y
    // otro sujeto (spec 003, RN-19). Este guard no opina sobre ellas.
    if (this.isFloorRoute(context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = readSessionCookie(request, SESSION_COOKIE_NAME);

    if (token === undefined) {
      throw invalidSession();
    }

    const payload = await this.tokens.verify(token);

    if (payload === null) {
      throw invalidSession();
    }

    // RN-19: este guard solo acepta sesiones de oficina. Un token de pista
    // lleva la misma firma —mismo secreto— asi que sin este chequeo lo unico
    // que lo frena es que su `sub` no exista en `users`, que es una colision
    // que no ocurre por suerte, no una defensa. Pasada la jornada de despliegue,
    // se exige estrictamente `kind === 'user'` (spec 003, Tareas).
    if (payload.kind !== 'user') {
      throw invalidSession();
    }

    const user = await this.users.findById(payload.sub);

    // RN-4: un usuario desactivado pierde sus sesiones abiertas, aunque su JWT
    // siga siendo valido.
    if (user === null || !user.isActive) {
      throw invalidSession();
    }

    // RN-10: todo JWT emitido antes del ultimo cambio de contrasena se rechaza.
    if (isTokenIssuedBeforePasswordChange(payload.iat, user.passwordChangedAt, payload.iatMs)) {
      throw invalidSession();
    }

    attachSession(request, REQUEST_USER_KEY, toAuthenticatedUser(user));

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

  /** `true` si la ruta declaro pertenecer a la vista pista (RN-19). */
  private isFloorRoute(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(FLOOR_SESSION_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }
}
