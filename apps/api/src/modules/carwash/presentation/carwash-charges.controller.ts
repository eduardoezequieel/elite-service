import { API_ERROR_CODES, PERMISSIONS, createChargeSchema, voidChargeSchema } from '@elite/shared';
import type { Charge, CreateChargeInput, Ticket, VoidChargeInput } from '@elite/shared';
import {
  Body,
  Controller,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';

import {
  Authorizer,
  CurrentUser,
  RequireAuthorization,
  RequirePermissions,
} from '../../../common/auth/auth.decorators';
import type { ActionAuthorizer, AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { ChargeUseCases } from '../application/charge.usecases';
import { userActor } from './carwash-actor';

/**
 * La cuenta de cobro (059).
 *
 * Cobrar sigue siendo `carwash.charge`, igual que el lavado suelto: mancomunar
 * no es un permiso nuevo, es la misma caja cobrando tres carros de una vez.
 * Deshacer, en cambio, pide la firma de la 045, porque saca plata de un turno
 * que ya se conto.
 */
@Controller('carwash/charges')
export class CarwashChargesController {
  private static readonly chargeId = new ParseUUIDPipe({
    exceptionFactory: () =>
      new NotFoundException({ code: API_ERROR_CODES.NOT_FOUND, message: 'Ese cobro no existe.' }),
  });

  constructor(private readonly charges: ChargeUseCases) {}

  @Post()
  @RequirePermissions(PERMISSIONS.carwash.actions.charge.key)
  create(
    @Body(new ZodValidationPipe(createChargeSchema)) input: CreateChargeInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Charge> {
    return this.charges.create(input, user.id, userActor(user));
  }

  /**
   * Deshace la cuenta entera (RN-8). La autorizacion se pide una vez, para la
   * cuenta: no tendria sentido firmar tres veces lo que es un solo cobro.
   */
  @Post(':id/void')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.carwash.actions.read.key)
  @RequireAuthorization(PERMISSIONS.carwash.actions.reverse.key)
  void(
    @Param('id', CarwashChargesController.chargeId) id: string,
    @Body(new ZodValidationPipe(voidChargeSchema)) input: VoidChargeInput,
    @CurrentUser() user: AuthenticatedUser,
    @Authorizer() authorizer: ActionAuthorizer,
  ): Promise<Ticket[]> {
    return this.charges.voidById(id, input, userActor(user), authorizer);
  }
}
