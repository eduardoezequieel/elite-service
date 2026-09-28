import { API_ERROR_CODES } from '@elite/shared';
import type { AuthorizationInput } from '@elite/shared';

import { ForbiddenError } from '../../../../common/errors/application-error';
import type { ActionAuthorizer } from '../../../../common/auth/authenticated-user';
import type { PriceAuthorizer } from '../ports/price-authorizer';

/** Quien firma en los tests: Don Beto, con la clave `secret`. */
export const PRICE_BOSS: ActionAuthorizer = { id: 'u-boss', fullName: 'Don Beto' };
export const PRICE_BOSS_CREDENTIALS: AuthorizationInput = {
  email: 'beto@elite.test',
  password: 'secret',
};

/** Autoriza solo a Don Beto y guarda que claves se le pidieron (060). */
export class FakePriceAuthorizer implements PriceAuthorizer {
  readonly calls: { email: string; required: readonly string[] }[] = [];

  authorize(input: AuthorizationInput, required: readonly string[]): Promise<ActionAuthorizer> {
    this.calls.push({ email: input.email, required });

    if (input.password !== PRICE_BOSS_CREDENTIALS.password) {
      return Promise.reject(
        new ForbiddenError({
          code: API_ERROR_CODES.AUTHORIZATION_FAILED,
          message: 'Esas credenciales no autorizan esta acción.',
        }),
      );
    }

    return Promise.resolve(PRICE_BOSS);
  }
}
