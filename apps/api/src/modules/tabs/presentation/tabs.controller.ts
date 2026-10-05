import {
  API_ERROR_CODES,
  PERMISSIONS,
  addTabLinesSchema,
  payTabSchema,
  tabHoldersQuerySchema,
  tabsQuerySchema,
  voidTabLineSchema,
} from '@elite/shared';
import type {
  AddTabLinesInput,
  PayTabInput,
  TabDetail,
  TabHolderOptions,
  TabHoldersQuery,
  TabList,
  TabsQuery,
  VoidTabLineInput,
} from '@elite/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser, RequirePermissions } from '../../../common/auth/auth.decorators';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { userActor } from '../../carwash/presentation/carwash-actor';
import { TabUseCases, type TabActorContext } from '../application/tab.usecases';

const { read, charge } = PERMISSIONS.carwash.actions;

/** Quien opera, sacado de la sesión de oficina que resolvió el guard (RN-9). */
function actorOf(user: AuthenticatedUser): TabActorContext {
  return { userId: user.id, event: userActor(user) };
}

/**
 * `/api/tabs` — cuentas abiertas (106). Solo sesión de oficina: la tablet de
 * pista no tiene cookie de usuario y el guard global la rechaza (RN-9).
 *
 * Sin permisos nuevos: es la misma caja vendiendo a crédito. Se ve con
 * `carwash.read`, como «Ventas del día», y se anota, se quita y se cobra con
 * `carwash.charge`, como la venta suelta.
 */
@Controller('tabs')
export class TabsController {
  private static readonly tabId = new ParseUUIDPipe({
    exceptionFactory: () =>
      new NotFoundException({ code: API_ERROR_CODES.NOT_FOUND, message: 'Esa cuenta no existe.' }),
  });

  private static readonly lineId = new ParseUUIDPipe({
    exceptionFactory: () =>
      new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Esa línea no es de esta cuenta.',
      }),
  });

  constructor(private readonly tabs: TabUseCases) {}

  @Get()
  @RequirePermissions(read.key)
  list(@Query(new ZodValidationPipe(tabsQuerySchema)) query: TabsQuery): Promise<TabList> {
    return this.tabs.list(query);
  }

  /** El selector de titular: va antes de `:id` para que `holders` no se lea como un id. */
  @Get('holders')
  @RequirePermissions(charge.key)
  holders(
    @Query(new ZodValidationPipe(tabHoldersQuerySchema)) query: TabHoldersQuery,
  ): Promise<TabHolderOptions> {
    return this.tabs.holders(query);
  }

  @Get(':id')
  @RequirePermissions(read.key)
  findById(@Param('id', TabsController.tabId) id: string): Promise<TabDetail> {
    return this.tabs.findById(id);
  }

  /** Anota a la cuenta abierta del titular o le abre una (RN-2). */
  @Post('lines')
  @RequirePermissions(charge.key)
  addLines(
    @Body(new ZodValidationPipe(addTabLinesSchema)) input: AddTabLinesInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TabDetail> {
    return this.tabs.addLines(input, actorOf(user));
  }

  @Post(':id/lines/:lineId/void')
  @HttpCode(200)
  @RequirePermissions(charge.key)
  voidLine(
    @Param('id', TabsController.tabId) id: string,
    @Param('lineId', TabsController.lineId) lineId: string,
    @Body(new ZodValidationPipe(voidTabLineSchema)) input: VoidTabLineInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TabDetail> {
    return this.tabs.voidLine(id, lineId, input, actorOf(user));
  }

  @Post(':id/payments')
  @RequirePermissions(charge.key)
  pay(
    @Param('id', TabsController.tabId) id: string,
    @Body(new ZodValidationPipe(payTabSchema)) input: PayTabInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TabDetail> {
    return this.tabs.pay(id, input, actorOf(user));
  }
}
