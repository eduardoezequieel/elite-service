import {
  API_ERROR_CODES,
  PERMISSIONS,
  cashSessionsQuerySchema,
  closeCashSchema,
  openCashSchema,
} from '@elite/shared';
import type {
  CashSession,
  CashSessionDetail,
  CashSessionsQuery,
  CloseCashInput,
  OpenCashInput,
  Page,
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
import { CashSessionUseCases } from '../application/cash-session.usecases';

@Controller('carwash/cash')
@RequirePermissions(PERMISSIONS.carwash.actions.cash.key)
export class CarwashCashController {
  private static readonly sessionId = new ParseUUIDPipe({
    exceptionFactory: () =>
      new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese turno de caja no existe.',
      }),
  });

  constructor(private readonly cash: CashSessionUseCases) {}

  /**
   * OPEN session or JSON `null`. Nest skips the body when a handler returns
   * `null`, so this endpoint writes the response itself.
   */
  @Get('current')
  async current(@Res() response: Response): Promise<void> {
    const session = await this.cash.current();

    response.status(HttpStatus.OK).json(session);
  }

  /** Los turnos, de a una pagina (102). */
  @Get('sessions')
  list(
    @Query(new ZodValidationPipe(cashSessionsQuerySchema)) query: CashSessionsQuery,
  ): Promise<Page<CashSession>> {
    return this.cash.list(query);
  }

  /** Un turno; `?page&pageSize` corta sus pagos, los totales son del turno entero (102). */
  @Get('sessions/:id')
  getById(
    @Param('id', CarwashCashController.sessionId) id: string,
    @Query(new ZodValidationPipe(cashSessionsQuerySchema)) query: CashSessionsQuery,
  ): Promise<CashSessionDetail> {
    return this.cash.getById(id, query);
  }

  @Post('open')
  open(
    @Body(new ZodValidationPipe(openCashSchema)) input: OpenCashInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CashSession> {
    return this.cash.open(input, user.id);
  }

  @Post('close')
  @HttpCode(HttpStatus.OK)
  close(
    @Body(new ZodValidationPipe(closeCashSchema)) input: CloseCashInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CashSession> {
    return this.cash.close(input, user.id);
  }
}
