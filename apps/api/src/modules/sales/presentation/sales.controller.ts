import {
  API_ERROR_CODES,
  PERMISSIONS,
  counterSalesQuerySchema,
  createCounterSaleSchema,
  voidCounterSaleSchema,
} from '@elite/shared';
import type {
  CounterSale,
  CounterSalesQuery,
  CreateCounterSaleInput,
  Page,
  VoidCounterSaleInput,
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

import {
  Authorizer,
  CurrentUser,
  RequireAuthorization,
  RequirePermissions,
} from '../../../common/auth/auth.decorators';
import type { ActionAuthorizer, AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { userActor } from '../../carwash/presentation/carwash-actor';
import { CounterSaleUseCases } from '../application/counter-sale.usecases';

/**
 * La venta suelta (065 RN-18 a RN-22).
 *
 * No hay permisos nuevos: se ve con `carwash.read`, se vende con
 * `carwash.charge` —es la misma caja cobrando— y se anula con la firma de
 * `carwash.void` (045), igual que un lavado: para llegar alcanza con ver el
 * modulo, y el permiso lo pone quien escribe sus credenciales.
 */
@Controller('sales')
export class SalesController {
  private static readonly saleId = new ParseUUIDPipe({
    exceptionFactory: () =>
      new NotFoundException({ code: API_ERROR_CODES.NOT_FOUND, message: 'Esa venta no existe.' }),
  });

  constructor(private readonly sales: CounterSaleUseCases) {}

  @Get()
  @RequirePermissions(PERMISSIONS.carwash.actions.read.key)
  list(
    @Query(new ZodValidationPipe(counterSalesQuerySchema)) query: CounterSalesQuery,
  ): Promise<Page<CounterSale>> {
    return this.sales.list(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.carwash.actions.read.key)
  findById(@Param('id', SalesController.saleId) id: string): Promise<CounterSale> {
    return this.sales.findById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.carwash.actions.charge.key)
  create(
    @Body(new ZodValidationPipe(createCounterSaleSchema)) input: CreateCounterSaleInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CounterSale> {
    return this.sales.create(input, user.id, userActor(user));
  }

  @Post(':id/void')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.carwash.actions.read.key)
  @RequireAuthorization(PERMISSIONS.carwash.actions.void.key)
  void(
    @Param('id', SalesController.saleId) id: string,
    @Body(new ZodValidationPipe(voidCounterSaleSchema)) input: VoidCounterSaleInput,
    @CurrentUser() user: AuthenticatedUser,
    @Authorizer() authorizer: ActionAuthorizer,
  ): Promise<CounterSale> {
    return this.sales.voidById(id, input, authorizer, userActor(user));
  }
}
