import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import {
  CreateCustomerUseCase,
  ListCustomersUseCase,
  UpdateCustomerUseCase,
} from './application/customer.usecases';
import { CUSTOMER_REPOSITORY } from './application/ports/customer.repository';
import type { CustomerRepository } from './application/ports/customer.repository';
import { PrismaCustomerRepository } from './infrastructure/prisma-customer.repository';
import { CustomersController } from './presentation/customers.controller';

/**
 * Clientes. Exporta el repositorio porque la pista tambien da de alta clientes
 * al vuelo (RN-7) y el modulo de tickets lo necesita.
 */
@Module({
  imports: [PrismaModule],
  controllers: [CustomersController],
  providers: [
    { provide: CUSTOMER_REPOSITORY, useClass: PrismaCustomerRepository },
    {
      provide: ListCustomersUseCase,
      useFactory: (customers: CustomerRepository) => new ListCustomersUseCase(customers),
      inject: [CUSTOMER_REPOSITORY],
    },
    {
      provide: CreateCustomerUseCase,
      useFactory: (customers: CustomerRepository) => new CreateCustomerUseCase(customers),
      inject: [CUSTOMER_REPOSITORY],
    },
    {
      provide: UpdateCustomerUseCase,
      useFactory: (customers: CustomerRepository) => new UpdateCustomerUseCase(customers),
      inject: [CUSTOMER_REPOSITORY],
    },
  ],
  exports: [CUSTOMER_REPOSITORY, ListCustomersUseCase, CreateCustomerUseCase],
})
export class CustomersModule {}
