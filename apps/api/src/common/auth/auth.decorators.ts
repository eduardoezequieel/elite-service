import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';

import { REQUEST_USER_KEY, type AuthenticatedUser } from './authenticated-user';

/**
 * Decoradores de autorizacion.
 *
 * La regla que manda: se autoriza por clave `module.action`, NUNCA por nombre
 * de rol (RN-1). Los roles se crean a demanda desde la administracion y no
 * existen en el codigo.
 */

export const IS_PUBLIC_KEY = 'auth:isPublic';

/**
 * Marca un endpoint como publico: el guard global de JWT lo deja pasar sin
 * sesion. Solo el login, el logout y el health check.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

export const REQUIRED_PERMISSIONS_KEY = 'auth:requiredPermissions';

/**
 * Exige una o mas claves `module.action` para llegar al handler. Si se pasan
 * varias, se exigen todas. Sin sesion responde 401; con sesion pero sin el
 * permiso, 403.
 *
 * @example
 * ```ts
 * @RequirePermissions('users.read')
 * findAll() { ... }
 * ```
 */
export const RequirePermissions = (
  ...permissions: string[]
): MethodDecorator & ClassDecorator => SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);

/**
 * Inyecta el usuario que resolvio el guard, ya con sus permisos efectivos.
 * Solo tiene sentido en endpoints no publicos.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<Record<string, unknown>>();

    return request[REQUEST_USER_KEY] as AuthenticatedUser;
  },
);
