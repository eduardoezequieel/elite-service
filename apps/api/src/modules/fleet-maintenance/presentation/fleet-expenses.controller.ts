import {
  API_ERROR_CODES,
  PERMISSIONS,
  createFleetExpenseSchema,
  fleetExpensesQuerySchema,
  updateFleetExpenseSchema,
} from '@elite/shared';
import type {
  CreateFleetExpenseInput,
  FleetExpenseList,
  FleetExpenseRow,
  FleetExpensesQuery,
  UpdateFleetExpenseInput,
} from '@elite/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { CurrentUser, RequirePermissions } from '../../../common/auth/auth.decorators';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { FleetExpenseUseCases } from '../application/fleet-expense.usecases';

const { read, manage } = PERMISSIONS.fleet.actions;

/**
 * `/api/fleet/expenses` (099): los tres orígenes en la lista; solo los gastos
 * manuales que no salen de un servicio se editan o se borran.
 */
@Controller('fleet/expenses')
export class FleetExpensesController {
  private static readonly expenseId = new ParseUUIDPipe({
    exceptionFactory: () =>
      new NotFoundException({ code: API_ERROR_CODES.NOT_FOUND, message: 'Ese gasto no existe.' }),
  });

  constructor(private readonly expenses: FleetExpenseUseCases) {}

  @Get()
  @RequirePermissions(read.key)
  findAll(
    @Query(new ZodValidationPipe(fleetExpensesQuerySchema)) query: FleetExpensesQuery,
  ): Promise<FleetExpenseList> {
    return this.expenses.list(query);
  }

  @Post()
  @RequirePermissions(manage.key)
  create(
    @Body(new ZodValidationPipe(createFleetExpenseSchema)) input: CreateFleetExpenseInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FleetExpenseRow> {
    return this.expenses.create(input, user.id);
  }

  @Patch(':id')
  @RequirePermissions(manage.key)
  update(
    @Param('id', FleetExpensesController.expenseId) id: string,
    @Body(new ZodValidationPipe(updateFleetExpenseSchema)) input: UpdateFleetExpenseInput,
  ): Promise<FleetExpenseRow> {
    return this.expenses.update(id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(manage.key)
  remove(@Param('id', FleetExpensesController.expenseId) id: string): Promise<void> {
    return this.expenses.remove(id);
  }
}
