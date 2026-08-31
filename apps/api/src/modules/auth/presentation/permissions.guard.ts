import { API_ERROR_CODES } from '@elite/shared';
import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { REQUIRED_PERMISSIONS_KEY } from '../../../common/auth/auth.decorators';
import { REQUEST_USER_KEY } from '../../../common/auth/authenticated-user';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { hasAllPermissions } from '../domain/auth-user';

/**
 * Guard global de autorizacion. Se registra como `APP_GUARD` DESPUES de
 * `JwtAuthGuard`, que es quien deja al usuario en el request.
 *
 * Evalua siempre claves `module.action`: aca nunca se mira el nombre de un rol
 * (RN-1). Un handler sin `@RequirePermissions()` pasa: pedir sesion es trabajo
 * del otro guard.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (required === undefined || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Record<string, unknown>>();
    const user = request[REQUEST_USER_KEY] as AuthenticatedUser | undefined;

    if (user === undefined) {
      throw new UnauthorizedException({
        code: API_ERROR_CODES.UNAUTHORIZED,
        message: 'Tu sesión no es válida. Iniciá sesión de nuevo.',
      });
    }

    // Se exigen TODAS las claves declaradas, contra la union de los permisos de
    // todos sus roles (RN-3).
    if (!hasAllPermissions(user.permissions, required)) {
      throw new ForbiddenException({
        code: API_ERROR_CODES.FORBIDDEN,
        message: 'No tenés permiso para hacer esto.',
      });
    }

    return true;
  }
}
