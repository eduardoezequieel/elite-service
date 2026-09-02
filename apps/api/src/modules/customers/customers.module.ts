import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import {
  CreateCustomerUseCase,
  FindCustomerMatchUseCase,
  GetCustomerUseCase,
  ListCustomersUseCase,
  UpdateCustomerUseCase,
} from './application/customer.usecases';
import { CUSTOMER_REPOSITORY } from './application/ports/customer.repository';
import type { CustomerRepository } from './application/ports/customer.repository';
import { PrismaCustomerRepository } from './infrastructure/prisma-customer.repository';
import { CustomersController } from './presentation/customers.controller';

/**
 * Clientes. Exporta el repositorio porque la pista tambien da de alta clientes
 * al vuelo (RN-7) y el modulo de tickets lo necesita; exporta ademas los casos
 * de uso de lectura y de coincidencia, que son los que la pista consume desde
 * su propio controller (004 RN-5).
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
      provide: GetCustomerUseCase,
      useFactory: (customers: CustomerRepository) => new GetCustomerUseCase(customers),
      inject: [CUSTOMER_REPOSITORY],
    },
    {
      provide: FindCustomerMatchUseCase,
      useFactory: (customers: CustomerRepository) => new FindCustomerMatchUseCase(customers),
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
  exports: [
    CUSTOMER_REPOSITORY,
    ListCustomersUseCase,
    FindCustomerMatchUseCase,
    CreateCustomerUseCase,
  ],
})
export class CustomersModule {}
