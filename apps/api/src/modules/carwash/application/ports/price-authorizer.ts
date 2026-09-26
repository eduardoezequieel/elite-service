import type { AuthorizationInput } from '@elite/shared';

import type { ActionAuthorizer } from '../../../../common/auth/authenticated-user';

/**
 * Verifica credenciales de un tercero contra claves `module.action` (045).
 *
 * Deshacer un cobro lo firma el `AuthorizationGuard` global, porque su bloque
 * `authorization` viaja en la raiz del body. El precio de un producto suelto de
 * la cuenta no (065 RN-21, 066): la firma es opcional y va dentro de
 * `priceAuthorization`, asi que la pide el caso de uso solo cuando alguna linea
 * baja del precio. Lo implementa el mismo `AuthorizeActionUseCase` de auth: un
 * solo verificador, un solo mensaje.
 *
 * @throws 403 `AUTHORIZATION_FAILED` si no autoriza.
 */
export interface PriceAuthorizer {
  authorize(
    credentials: AuthorizationInput,
    required: readonly string[],
  ): Promise<ActionAuthorizer>;
}

export const PRICE_AUTHORIZER = Symbol('carwash.PriceAuthorizer');
