import {
  API_ERROR_CODES,
  PERMISSIONS,
  createCustomerSchema,
  updateCustomerSchema,
} from '@elite/shared';
import type { CreateCustomerInput, Customer, UpdateCustomerInput } from '@elite/shared';
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { RequirePermissions } from '../../../common/auth/auth.decorators';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import {
  CreateCustomerUseCase,
  ListCustomersUseCase,
  UpdateCustomerUseCase,
} from '../application/customer.usecases';

/** Clientes desde la oficina. Sin `DELETE`: se desactivan (RN-13). */
@Controller('customers')
export class CustomersController {
  private static readonly customerId = new ParseUUIDPipe({
    exceptionFactory: () =>
      new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese cliente no existe.',
      }),
  });

  constructor(
    private readonly listCustomers: ListCustomersUseCase,
    private readonly createCustomer: CreateCustomerUseCase,
    private readonly updateCustomer: UpdateCustomerUseCase,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.customers.actions.read.key)
  findAll(@Query('q') query?: string): Promise<Customer[]> {
    return this.listCustomers.execute(query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.customers.actions.manage.key)
  create(
    @Body(new ZodValidationPipe(createCustomerSchema)) input: CreateCustomerInput,
  ): Promise<Customer> {
    return this.createCustomer.execute(input);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.customers.actions.manage.key)
  update(
    @Param('id', CustomersController.customerId) id: string,
    @Body(new ZodValidationPipe(updateCustomerSchema)) input: UpdateCustomerInput,
  ): Promise<Customer> {
    return this.updateCustomer.execute(id, input);
  }
}
