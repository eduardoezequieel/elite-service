import {
  API_ERROR_CODES,
  PERMISSIONS,
  cashSessionsQuerySchema,
  closeCashSchema,
  openCashSchema,
} from '@elite/shared';
import type {
  CashSessionsQuery,
  CloseCashInput,
  OpenCashInput,
  Page,
  RentalCashSession,
  RentalCashSessionDetail,
} from '@elite/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { CurrentUser, RequirePermissions } from '../../../common/auth/auth.decorators';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { RentalCashUseCases } from '../application/rental-cash.usecases';

/**
 * La caja de la rentadora (109): un turno con fondo, cobros y cierre. Otra
 * tabla que la del lavado. `GET /rentals/cash` (el reporte diario de la 098)
 * no tiene handler: responde 404.
 */
@Controller('rentals/cash')
@RequirePermissions(PERMISSIONS.rentals.actions.charge.key)
export class RentalCashController {
  private static readonly sessionId = new ParseUUIDPipe({
    exceptionFactory: () =>
      new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese turno de caja no existe.',
      }),
  });

  constructor(private readonly cash: RentalCashUseCases) {}

  /**
   * El turno abierto, o JSON `null`. Nest no escribe el cuerpo cuando el
   * handler devuelve `null`, así que este endpoint arma la respuesta.
   */
  @Get('current')
  async current(@Res() response: Response): Promise<void> {
    const session = await this.cash.current();

    response.status(HttpStatus.OK).json(session);
  }

  @Get('sessions')
  list(
    @Query(new ZodValidationPipe(cashSessionsQuerySchema)) query: CashSessionsQuery,
  ): Promise<Page<RentalCashSession>> {
    return this.cash.list(query);
  }

  @Get('sessions/:id')
  getById(
    @Param('id', RentalCashController.sessionId) id: string,
    @Query(new ZodValidationPipe(cashSessionsQuerySchema)) query: CashSessionsQuery,
  ): Promise<RentalCashSessionDetail> {
    return this.cash.getById(id, query);
  }

  @Post('open')
  open(
    @Body(new ZodValidationPipe(openCashSchema)) input: OpenCashInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RentalCashSession> {
    return this.cash.open(input, user.id);
  }

  @Post('close')
  @HttpCode(HttpStatus.OK)
  close(
    @Body(new ZodValidationPipe(closeCashSchema)) input: CloseCashInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RentalCashSession> {
    return this.cash.close(input, user.id);
  }
}
