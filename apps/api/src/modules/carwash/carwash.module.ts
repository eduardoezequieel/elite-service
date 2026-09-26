import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthorizeActionUseCase } from '../auth/application/authorize-action.usecase';
import { BcryptPasswordHasher } from '../auth/infrastructure/bcrypt-password-hasher';
import { PrismaAuthUserRepository } from '../auth/infrastructure/prisma-auth-user.repository';
import { CustomersModule } from '../customers/customers.module';
import { CUSTOMER_REPOSITORY } from '../customers/application/ports/customer.repository';
import type { CustomerRepository } from '../customers/application/ports/customer.repository';
import { ServicesModule } from '../services/services.module';
import { SERVICE_CATALOG_REPOSITORY } from '../services/application/ports/service-catalog.repository';
import type { ServiceCatalogRepository } from '../services/application/ports/service-catalog.repository';
import { LOW_STOCK_EVENTS } from '../inventory/application/ports/low-stock-events';
import type { LowStockPublisher } from '../inventory/application/ports/low-stock-events';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { VEHICLE_REPOSITORY } from '../vehicles/application/ports/vehicle.repository';
import type { VehicleRepository } from '../vehicles/application/ports/vehicle.repository';
import { CashSessionUseCases } from './application/cash-session.usecases';
import { ChargeUseCases } from './application/charge.usecases';
import { PerformanceUseCases } from './application/performance.usecases';
import { PERFORMANCE_REPOSITORY } from './application/ports/performance.repository';
import type { PerformanceRepository } from './application/ports/performance.repository';
import { CHARGE_REPOSITORY } from './application/ports/charge.repository';
import type { ChargeRepository } from './application/ports/charge.repository';
import { CASH_SESSION_REPOSITORY } from './application/ports/cash-session.repository';
import { INVENTORY_CATALOG } from './application/ports/inventory-catalog';
import type { InventoryCatalog } from './application/ports/inventory-catalog';
import { PRICE_AUTHORIZER } from './application/ports/price-authorizer';
import type { PriceAuthorizer } from './application/ports/price-authorizer';
import type { CashSessionRepository } from './application/ports/cash-session.repository';
import { TICKET_EVENTS } from './application/ports/ticket-events';
import type { TicketEventsPublisher } from './application/ports/ticket-events';
import { TICKET_REPOSITORY } from './application/ports/ticket.repository';
import type { TicketRepository } from './application/ports/ticket.repository';
import { TicketUseCases } from './application/ticket.usecases';
import { PrismaCashSessionRepository } from './infrastructure/prisma-cash-session.repository';
import { PrismaChargeRepository } from './infrastructure/prisma-charge.repository';
import { PrismaInventoryCatalog } from './infrastructure/prisma-inventory-catalog';
import { PrismaPerformanceRepository } from './infrastructure/prisma-performance.repository';
import { PrismaTicketRepository } from './infrastructure/prisma-ticket.repository';
import { TicketEventsBus } from './infrastructure/ticket-events.bus';
import { CarwashCashController } from './presentation/carwash-cash.controller';
import { CarwashChargesController } from './presentation/carwash-charges.controller';
import { CarwashPerformanceController } from './presentation/carwash-performance.controller';
import { CarwashStreamController } from './presentation/carwash-stream.controller';
import { CarwashTicketsController } from './presentation/carwash-tickets.controller';
import { FloorStreamController } from './presentation/floor-stream.controller';
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
  controllers: [
    FloorTicketsController,
    FloorStreamController,
    CarwashTicketsController,
    CarwashStreamController,
    CarwashCashController,
    CarwashChargesController,
    CarwashPerformanceController,
  ],
  providers: [
    { provide: TICKET_REPOSITORY, useClass: PrismaTicketRepository },
    { provide: CASH_SESSION_REPOSITORY, useClass: PrismaCashSessionRepository },
    { provide: CHARGE_REPOSITORY, useClass: PrismaChargeRepository },
    { provide: INVENTORY_CATALOG, useClass: PrismaInventoryCatalog },
    { provide: PERFORMANCE_REPOSITORY, useClass: PrismaPerformanceRepository },
    // Un solo objeto para los dos roles del puerto: el que publica y el que se
    // escucha tienen que ser el mismo bus, o los eventos no llegarian a nadie.
    TicketEventsBus,
    { provide: TICKET_EVENTS, useExisting: TicketEventsBus },
    // El aviso de minimo del inventario (065 RN-13) sale por el mismo bus, asi
    // llega por el stream de oficina sin un segundo hilo.
    { provide: LOW_STOCK_EVENTS, useExisting: TicketEventsBus },
    {
      // La firma del precio de un producto suelto (060, 065 RN-21): el mismo
      // verificador de la 045 que usa el guard global, un solo criterio y un
      // solo mensaje para las credenciales de un tercero.
      provide: PRICE_AUTHORIZER,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService): PriceAuthorizer => {
        const verifier = new AuthorizeActionUseCase(
          new PrismaAuthUserRepository(prisma),
          new BcryptPasswordHasher(),
        );

        return { authorize: (credentials, required) => verifier.execute(credentials, required) };
      },
    },
    // Todo cobro entra por `ChargeUseCases`, tenga un lavado, cinco o
    // productos sueltos (059 RN-1, 066). `TicketUseCases` lo recibe para que el
    // endpoint viejo delegue en el mismo caso de uso, y la venta suelta lo
    // importa para cobrar una cuenta sin lavados.
    {
      provide: ChargeUseCases,
      useFactory: (
        charges: ChargeRepository,
        tickets: TicketRepository,
        cashSessions: CashSessionRepository,
        events: TicketEventsPublisher,
        inventory: InventoryCatalog,
        authorizer: PriceAuthorizer,
        lowStock: LowStockPublisher,
      ): ChargeUseCases =>
        new ChargeUseCases(charges, tickets, cashSessions, events, inventory, authorizer, lowStock),
      inject: [
        CHARGE_REPOSITORY,
        TICKET_REPOSITORY,
        CASH_SESSION_REPOSITORY,
        TICKET_EVENTS,
        INVENTORY_CATALOG,
        PRICE_AUTHORIZER,
        LOW_STOCK_EVENTS,
      ],
    },
    {
      provide: TicketUseCases,
      useFactory: (
        tickets: TicketRepository,
        catalog: ServiceCatalogRepository,
        customers: CustomerRepository,
        vehicles: VehicleRepository,
        charges: ChargeUseCases,
        events: TicketEventsPublisher,
        inventory: InventoryCatalog,
        lowStock: LowStockPublisher,
      ): TicketUseCases =>
        new TicketUseCases(
          tickets,
          catalog,
          customers,
          vehicles,
          charges,
          events,
          inventory,
          lowStock,
        ),
      inject: [
        TICKET_REPOSITORY,
        SERVICE_CATALOG_REPOSITORY,
        CUSTOMER_REPOSITORY,
        VEHICLE_REPOSITORY,
        ChargeUseCases,
        TICKET_EVENTS,
        INVENTORY_CATALOG,
        LOW_STOCK_EVENTS,
      ],
    },
    {
      provide: PerformanceUseCases,
      useFactory: (performance: PerformanceRepository): PerformanceUseCases =>
        new PerformanceUseCases(performance),
      inject: [PERFORMANCE_REPOSITORY],
    },
    {
      provide: CashSessionUseCases,
      useFactory: (sessions: CashSessionRepository): CashSessionUseCases =>
        new CashSessionUseCases(sessions),
      inject: [CASH_SESSION_REPOSITORY],
    },
  ],
  // Lo que reusan el inventario y la venta suelta (065, 066): el aviso de
  // minimo por el mismo bus, el turno de caja donde entran los pagos, el
  // stream, el selector de productos y la cuenta de cobro.
  exports: [
    LOW_STOCK_EVENTS,
    TICKET_EVENTS,
    CASH_SESSION_REPOSITORY,
    INVENTORY_CATALOG,
    ChargeUseCases,
  ],
})
export class CarwashModule {}
