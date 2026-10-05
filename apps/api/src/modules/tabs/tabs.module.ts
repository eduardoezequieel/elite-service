import { Module } from '@nestjs/common';

import { CarwashModule } from '../carwash/carwash.module';
import { LOW_STOCK_EVENTS } from '../inventory/application/ports/low-stock-events';
import type { LowStockPublisher } from '../inventory/application/ports/low-stock-events';
import { TAB_LOOKUPS } from './application/ports/tab-lookups';
import type { TabLookups } from './application/ports/tab-lookups';
import { TAB_PAYMENTS_READER } from './application/ports/tab-payments-reader';
import { TAB_REPOSITORY } from './application/ports/tab.repository';
import type { TabRepository } from './application/ports/tab.repository';
import { TabUseCases } from './application/tab.usecases';
import { PrismaTabLookups } from './infrastructure/prisma-tab-lookups';
import { PrismaTabPaymentsReader } from './infrastructure/prisma-tab-payments-reader';
import { PrismaTabRepository } from './infrastructure/prisma-tab.repository';
import { TabsController } from './presentation/tabs.controller';

/**
 * Cuentas abiertas (106). Importa `CarwashModule` solo por `LOW_STOCK_EVENTS`:
 * el aviso de mínimo sale por el mismo bus que el del lavado. Exporta
 * `TAB_PAYMENTS_READER` para «Ventas del día» (`SalesModule`); la dependencia
 * va en un solo sentido.
 */
@Module({
  imports: [CarwashModule],
  controllers: [TabsController],
  providers: [
    { provide: TAB_REPOSITORY, useClass: PrismaTabRepository },
    { provide: TAB_LOOKUPS, useClass: PrismaTabLookups },
    { provide: TAB_PAYMENTS_READER, useClass: PrismaTabPaymentsReader },
    {
      provide: TabUseCases,
      inject: [TAB_REPOSITORY, TAB_LOOKUPS, LOW_STOCK_EVENTS],
      useFactory: (
        tabs: TabRepository,
        lookups: TabLookups,
        lowStock: LowStockPublisher,
      ): TabUseCases => new TabUseCases(tabs, lookups, lowStock),
    },
  ],
  exports: [TAB_PAYMENTS_READER],
})
export class TabsModule {}
