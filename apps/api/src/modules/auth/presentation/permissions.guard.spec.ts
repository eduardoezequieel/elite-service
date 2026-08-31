import { API_ERROR_CODES } from '@elite/shared';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RequirePermissions } from '../../../common/auth/auth.decorators';
import { REQUEST_USER_KEY } from '../../../common/auth/authenticated-user';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { PermissionsGuard } from './permissions.guard';

/** Controller de mentira: solo existe para colgarle la metadata del decorador. */
class TestController {
  @RequirePermissions('users.read', 'users.manage')
  guarded(): void {
    // No se ejecuta: al guard solo le interesa la metadata del handler.
  }

  open(): void {
    // Sin `@RequirePermissions()`: no declara ninguna clave.
  }
}

type Handler = TestController['guarded'];

function buildUser(permissions: string[]): AuthenticatedUser {
  return {
    id: 'user-1',
    email: 'mecanico@elite.local',
    fullName: 'Ana Mecánica',
    // El nombre del rol es dato: el guard no lo mira jamas (RN-1).
    roles: [{ id: 'role-1', name: 'Recepción' }],
    permissions,
  };
}

function buildContext(handler: Handler, user?: AuthenticatedUser): ExecutionContext {
  const request: Record<string, unknown> = {};

  if (user !== undefined) {
    request[REQUEST_USER_KEY] = user;
  }

  return {
    getHandler: () => handler,
    getClass: () => TestController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  const guard = new PermissionsGuard(new Reflector());

  it('lets the request through when the user has every declared permission', () => {
    const context = buildContext(
      TestController.prototype.guarded,
      buildUser(['users.read', 'users.manage', 'roles.read']),
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('answers 403 FORBIDDEN when one of the declared permissions is missing', () => {
    const context = buildContext(TestController.prototype.guarded, buildUser(['users.read']));

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);

    try {
      guard.canActivate(context);
    } catch (error: unknown) {
      expect((error as ForbiddenException).getStatus()).toBe(403);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: API_ERROR_CODES.FORBIDDEN,
      });
    }
  });

  it('lets the request through when the handler declares no permission at all', () => {
    const context = buildContext(TestController.prototype.open, buildUser([]));

    expect(guard.canActivate(context)).toBe(true);
  });

  it('answers 401 when the request carries no authenticated user', () => {
    const context = buildContext(TestController.prototype.guarded);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
