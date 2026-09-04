import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { CustomersModule } from '../customers/customers.module';
import { CUSTOMER_REPOSITORY } from '../customers/application/ports/customer.repository';
import type { CustomerRepository } from '../customers/application/ports/customer.repository';
import { ServicesModule } from '../services/services.module';
import { SERVICE_CATALOG_REPOSITORY } from '../services/application/ports/service-catalog.repository';
import type { ServiceCatalogRepository } from '../services/application/ports/service-catalog.repository';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { VEHICLE_REPOSITORY } from '../vehicles/application/ports/vehicle.repository';
import type { VehicleRepository } from '../vehicles/application/ports/vehicle.repository';
import { CashSessionUseCases } from './application/cash-session.usecases';
import { CASH_SESSION_REPOSITORY } from './application/ports/cash-session.repository';
import type { CashSessionRepository } from './application/ports/cash-session.repository';
import { TICKET_REPOSITORY } from './application/ports/ticket.repository';
import type { TicketRepository } from './application/ports/ticket.repository';
import { TicketUseCases } from './application/ticket.usecases';
import { PrismaCashSessionRepository } from './infrastructure/prisma-cash-session.repository';
import { PrismaTicketRepository } from './infrastructure/prisma-ticket.repository';
import { CarwashCashController } from './presentation/carwash-cash.controller';
import { CarwashTicketsController } from './presentation/carwash-tickets.controller';
import { FloorTicketsController } from './presentation/floor-tickets.controller';

/**
 * Tickets de lavado, con sus dos entradas.
 *
 * Los dos controllers comparten `TicketUseCases`: las diferencias entre pista y
 * oficina son quien puede llamar y con que datos, no como se calcula un precio
 * ni que transiciones existen. Con logica duplicada, un dia cobrarian distinto
 * por lo mismo.
 */
@Module({
  imports: [PrismaModule, CustomersModule, VehiclesModule, ServicesModule],
  controllers: [FloorTicketsController, CarwashTicketsController, CarwashCashController],
  providers: [
    { provide: TICKET_REPOSITORY, useClass: PrismaTicketRepository },
    { provide: CASH_SESSION_REPOSITORY, useClass: PrismaCashSessionRepository },
    {
      provide: TicketUseCases,
      useFactory: (
        tickets: TicketRepository,
        catalog: ServiceCatalogRepository,
        customers: CustomerRepository,
        vehicles: VehicleRepository,
        cashSessions: CashSessionRepository,
      ): TicketUseCases => new TicketUseCases(tickets, catalog, customers, vehicles, cashSessions),
      inject: [
        TICKET_REPOSITORY,
        SERVICE_CATALOG_REPOSITORY,
        CUSTOMER_REPOSITORY,
        VEHICLE_REPOSITORY,
        CASH_SESSION_REPOSITORY,
      ],
    },
    {
      provide: CashSessionUseCases,
      useFactory: (sessions: CashSessionRepository): CashSessionUseCases =>
        new CashSessionUseCases(sessions),
      inject: [CASH_SESSION_REPOSITORY],
    },
  ],
})
export class CarwashModule {}
