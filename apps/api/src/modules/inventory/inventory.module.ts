import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { CarwashModule } from '../carwash/carwash.module';
import { EmployeesModule } from '../employees/employees.module';
import { EMPLOYEE_REPOSITORY } from '../employees/application/ports/employee.repository';
import type { EmployeeRepository } from '../employees/application/ports/employee.repository';
import { InventoryBatchUseCases } from './application/inventory-batch.usecases';
import { InventoryCatalogUseCases } from './application/inventory-catalog.usecases';
import { InventoryMovementUseCases } from './application/inventory-movement.usecases';
import { INVENTORY_REPOSITORY } from './application/ports/inventory.repository';
import type { InventoryRepository } from './application/ports/inventory.repository';
import { LOW_STOCK_EVENTS } from './application/ports/low-stock-events';
import type { LowStockPublisher } from './application/ports/low-stock-events';
import { PrismaInventoryRepository } from './infrastructure/prisma-inventory.repository';
import { InventoryController } from './presentation/inventory.controller';

/**
 * Inventario: artículos, categorías y kardex (065) y entrada y entrega de varios
 * artículos a la vez (091). El consumo de empleados de la 070 se retiró: lo
 * reemplazan las cuentas abiertas (106).
 *
 * Importa `CarwashModule` solo por `LOW_STOCK_EVENTS`: el aviso de mínimo viaja
 * por el mismo stream de la 042, así que lo publica el bus del lavado. Al revés
 * no hay import de módulo —el lavado y la venta suelta usan `stock-ledger.ts`
 * como archivo—, así que no hay ciclo.
 */
@Module({
  imports: [PrismaModule, EmployeesModule, CarwashModule],
  controllers: [InventoryController],
  providers: [
    { provide: INVENTORY_REPOSITORY, useClass: PrismaInventoryRepository },
    {
      provide: InventoryCatalogUseCases,
      useFactory: (inventory: InventoryRepository): InventoryCatalogUseCases =>
        new InventoryCatalogUseCases(inventory),
      inject: [INVENTORY_REPOSITORY],
    },
    {
      provide: InventoryMovementUseCases,
      useFactory: (
        inventory: InventoryRepository,
        employees: EmployeeRepository,
        events: LowStockPublisher,
      ): InventoryMovementUseCases => new InventoryMovementUseCases(inventory, employees, events),
      inject: [INVENTORY_REPOSITORY, EMPLOYEE_REPOSITORY, LOW_STOCK_EVENTS],
    },
    {
      provide: InventoryBatchUseCases,
      useFactory: (
        inventory: InventoryRepository,
        employees: EmployeeRepository,
        events: LowStockPublisher,
      ): InventoryBatchUseCases => new InventoryBatchUseCases(inventory, employees, events),
      inject: [INVENTORY_REPOSITORY, EMPLOYEE_REPOSITORY, LOW_STOCK_EVENTS],
    },
  ],
})
export class InventoryModule {}
