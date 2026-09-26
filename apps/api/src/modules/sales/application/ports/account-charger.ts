import type { CarwashEventActor, Charge, CreateChargeInput } from '@elite/shared';

import type {
  AccountVoidRequest,
  VoidedAccount,
} from '../../../carwash/application/charge.usecases';

/**
 * La cuenta de cobro de la 059, vista desde la venta suelta (066).
 *
 * Vender es cobrar una cuenta sin lavados, y anular una venta es deshacer su
 * cuenta entera: los dos caminos son los de `ChargeUseCases`, que lo implementa
 * tal cual. La venta no escribe pagos ni kardex por su cuenta.
 */
export interface AccountCharger {
  create(
    input: CreateChargeInput,
    userId: string,
    actor: CarwashEventActor | null,
  ): Promise<Charge>;
  voidAccount(
    chargeId: string,
    request: AccountVoidRequest,
    actor: CarwashEventActor | null,
  ): Promise<VoidedAccount>;
}
