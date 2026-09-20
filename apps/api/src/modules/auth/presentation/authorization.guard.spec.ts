import { API_ERROR_CODES } from '@elite/shared';
import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RequireAuthorization } from '../../../common/auth/auth.decorators';
import { REQUEST_AUTHORIZER_KEY } from '../../../common/auth/authenticated-user';
import type { ActionAuthorizer } from '../../../common/auth/authenticated-user';
import { AuthorizeActionUseCase } from '../application/authorize-action.usecase';
import { AuthorizationGuard } from './authorization.guard';

/** Controller de mentira: solo existe para colgarle la metadata del decorador. */
class TestController {
  @RequireAuthorization('carwash.void')
  guarded(): void {
    // No se ejecuta: al guard solo le interesa la metadata del handler.
  }

  open(): void {
    // Sin `@RequireAuthorization()`: no pide firma de nadie.
  }
}

type Handler = TestController['guarded'];

const AUTHORIZER: ActionAuthorizer = { id: 'user-1', fullName: 'Ana Jefa' };

/**
 * Caso de uso de mentira. El guard no decide si las credenciales sirven — eso
 * se prueba en `authorize-action.usecase.spec.ts`—: lo suyo es leer la
 * metadata, validar la forma del bloque y dejar al autorizante en el request.
 */
function buildUseCase(result: ActionAuthorizer | Error): AuthorizeActionUseCase {
  return {
    execute: (): Promise<ActionAuthorizer> =>
      result instanceof Error ? Promise.reject(result) : Promise.resolve(result),
  } as unknown as AuthorizeActionUseCase;
}

function buildContext(
  handler: Handler,
  body: unknown,
): { context: ExecutionContext; request: Record<string, unknown> } {
  const request: Record<string, unknown> = { body };

  return {
    request,
    context: {
      getHandler: () => handler,
      getClass: () => TestController,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext,
  };
}

describe('AuthorizationGuard', () => {
  it('leaves the authorizer in the request when the credentials are valid', async () => {
    const guard = new AuthorizationGuard(new Reflector(), buildUseCase(AUTHORIZER));
    const { context, request } = buildContext(TestController.prototype.guarded, {
      reason: 'Cliente se arrepintió',
      authorization: { email: 'jefe@elite.local', password: 'secreta123' },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request[REQUEST_AUTHORIZER_KEY]).toEqual(AUTHORIZER);
  });

  it('ignores a handler that does not ask for authorization', async () => {
    const guard = new AuthorizationGuard(new Reflector(), buildUseCase(AUTHORIZER));
    const { context, request } = buildContext(TestController.prototype.open as Handler, {});

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request[REQUEST_AUTHORIZER_KEY]).toBeUndefined();
  });

  it('rejects a body without the authorization block, before looking at anything else', async () => {
    const guard = new AuthorizationGuard(new Reflector(), buildUseCase(AUTHORIZER));
    const { context } = buildContext(TestController.prototype.guarded, { reason: 'Sin firma' });

    // 422 del pipe compartido: el bloque no paso la validacion de forma.
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('lets the rejection of the use case through untouched', async () => {
    const rejection = new ForbiddenException({
      code: API_ERROR_CODES.AUTHORIZATION_FAILED,
      message: 'Esas credenciales no autorizan esta acción.',
    });
    const guard = new AuthorizationGuard(new Reflector(), buildUseCase(rejection));
    const { context, request } = buildContext(TestController.prototype.guarded, {
      authorization: { email: 'jefe@elite.local', password: 'mala' },
    });

    await expect(guard.canActivate(context)).rejects.toBe(rejection);
    expect(request[REQUEST_AUTHORIZER_KEY]).toBeUndefined();
  });
});
