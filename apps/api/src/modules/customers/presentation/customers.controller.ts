import {
  API_ERROR_CODES,
  PERMISSIONS,
  createCustomerSchema,
  customerMatchQuerySchema,
  customersQuerySchema,
  updateCustomerSchema,
} from '@elite/shared';
import type {
  CreateCustomerInput,
  Customer,
  CustomerMatch,
  CustomerMatchQuery,
  CustomersQuery,
  Page,
  UpdateCustomerInput,
} from '@elite/shared';
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
  FindCustomerMatchUseCase,
  GetCustomerUseCase,
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
    private readonly getCustomer: GetCustomerUseCase,
    private readonly findMatch: FindCustomerMatchUseCase,
    private readonly createCustomer: CreateCustomerUseCase,
    private readonly updateCustomer: UpdateCustomerUseCase,
  ) {}

  /** Los que coinciden, de a una página (048, 102): el cliente no tiene estado. */
  @Get()
  @RequirePermissions(PERMISSIONS.customers.actions.read.key)
  findAll(
    @Query(new ZodValidationPipe(customersQuerySchema)) query: CustomersQuery,
  ): Promise<Page<Customer>> {
    return this.listCustomers.page(query);
  }

  /**
   * ¿Ya existe alguien asi? (004 RN-1).
   *
   * Va **antes** de `:id` a proposito: Nest resuelve por orden de declaracion,
   * y al reves `match` entraria por la ruta del id y moriria en el parseo del
   * UUID con un 404 desconcertante.
   */
  @Get('match')
  @RequirePermissions(PERMISSIONS.customers.actions.read.key)
  match(
    @Query(new ZodValidationPipe(customerMatchQuerySchema)) query: CustomerMatchQuery,
  ): Promise<CustomerMatch | null> {
    return this.findMatch.execute(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.customers.actions.read.key)
  findOne(@Param('id', CustomersController.customerId) id: string): Promise<Customer> {
    return this.getCustomer.execute(id);
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
