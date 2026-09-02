import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';

import {
  REQUEST_EMPLOYEE_KEY,
  REQUEST_USER_KEY,
  type AuthenticatedEmployee,
  type AuthenticatedUser,
} from './authenticated-user';

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

export const FLOOR_SESSION_KEY = 'auth:floorSession';

/**
 * Marca una ruta como parte de la **vista pista** (spec 003, RN-19).
 *
 * Cambia que guard la atiende: el de oficina la deja pasar y el de pista la
 * exige. Sin este decorador, una ruta `/floor/*` cae en el guard de oficina y
 * le responde 401 a un empleado con sesion valida — un error silencioso, que
 * es justo por lo que hay un test que recorre las rutas registradas y falla si
 * alguna `/floor/*` se olvida de declararlo.
 */
export const FloorSession = (): MethodDecorator & ClassDecorator =>
  SetMetadata(FLOOR_SESSION_KEY, true);

/** Inyecta el empleado que resolvio el guard de pista. */
export const CurrentEmployee = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedEmployee => {
    const request = context.switchToHttp().getRequest<Record<string, unknown>>();

    return request[REQUEST_EMPLOYEE_KEY] as AuthenticatedEmployee;
  },
);
