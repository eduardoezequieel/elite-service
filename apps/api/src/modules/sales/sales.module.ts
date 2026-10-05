import { Module } from '@nestjs/common';

import { CarwashModule } from '../carwash/carwash.module';
import { ChargeUseCases } from '../carwash/application/charge.usecases';
import { TAB_PAYMENTS_READER } from '../tabs/application/ports/tab-payments-reader';
import type { TabPaymentsReader } from '../tabs/application/ports/tab-payments-reader';
import { TabsModule } from '../tabs/tabs.module';
import { CounterSaleUseCases } from './application/counter-sale.usecases';
import { COUNTER_SALE_REPOSITORY } from './application/ports/counter-sale.repository';
import type { CounterSaleRepository } from './application/ports/counter-sale.repository';
import { SalesFeedUseCases } from './application/sales-feed.usecases';
import { PrismaCounterSaleRepository } from './infrastructure/prisma-counter-sale.repository';
import { SalesController } from './presentation/sales.controller';

/**
 * Venta suelta (065, 066). Importa `CarwashModule` por `ChargeUseCases`: vender
 * es cobrar una cuenta sin lavados y anular es deshacer esa cuenta, asi que la
 * venta no escribe pagos ni kardex por su cuenta. La dependencia va en un solo
 * sentido: carwash no importa este modulo, solo el dominio de la venta y su
 * escritura dentro de la transaccion de la cuenta
 * (`infrastructure/counter-sale-ledger.ts`). Importa `TabsModule` solo por el
 * lector de abonos de «Ventas del día» (105).
 */
@Module({
  imports: [CarwashModule, TabsModule],
  controllers: [SalesController],
  providers: [
    { provide: COUNTER_SALE_REPOSITORY, useClass: PrismaCounterSaleRepository },
    {
      provide: CounterSaleUseCases,
      inject: [COUNTER_SALE_REPOSITORY, ChargeUseCases],
      useFactory: (sales: CounterSaleRepository, charges: ChargeUseCases): CounterSaleUseCases =>
        new CounterSaleUseCases(sales, charges),
    },
    {
      // «Ventas del día» con los abonos (105): los lee el lector que exporta TabsModule.
      provide: SalesFeedUseCases,
      inject: [COUNTER_SALE_REPOSITORY, TAB_PAYMENTS_READER],
      useFactory: (
        sales: CounterSaleRepository,
        tabPayments: TabPaymentsReader,
      ): SalesFeedUseCases => new SalesFeedUseCases(sales, tabPayments),
    },
  ],
})
export class SalesModule {}
