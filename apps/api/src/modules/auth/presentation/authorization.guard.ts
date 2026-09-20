import { authorizationSchema } from '@elite/shared';
import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { REQUIRED_AUTHORIZATION_KEY } from '../../../common/auth/auth.decorators';
import { REQUEST_AUTHORIZER_KEY } from '../../../common/auth/authenticated-user';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { AuthorizeActionUseCase } from '../application/authorize-action.usecase';

/**
 * Guard global de autorizacion por credenciales de un tercero (spec 045).
 *
 * Se registra como `APP_GUARD` DESPUES de `PermissionsGuard`: primero se exige
 * el permiso minimo del que esta adelante, y solo despues se le pide la firma a
 * quien puede darla. Un handler sin `@RequireAuthorization()` pasa de largo.
 *
 * Valida el bloque `authorization` con el mismo schema de `@elite/shared` que
 * usa el pipe del body, porque los guards corren antes que los pipes y aca
 * todavia no paso nadie.
 */
@Injectable()
export class AuthorizationGuard implements CanActivate {
  private static readonly credentials = new ZodValidationPipe(authorizationSchema);

  constructor(
    private readonly reflector: Reflector,
    private readonly authorize: AuthorizeActionUseCase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      REQUIRED_AUTHORIZATION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (required === undefined || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Record<string, unknown>>();
    const body = (request.body ?? {}) as Record<string, unknown>;
    const credentials = AuthorizationGuard.credentials.transform(body.authorization);

    // El autorizante queda en el request para que el handler lo escriba en la
    // nota. La contrasena no se guarda en ningun lado (RN-5).
    request[REQUEST_AUTHORIZER_KEY] = await this.authorize.execute(credentials, required);

    return true;
  }
}
