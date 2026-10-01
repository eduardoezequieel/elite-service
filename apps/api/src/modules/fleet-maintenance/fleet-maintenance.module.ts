import { Module } from '@nestjs/common';

import { businessDateOf } from '../inventory/domain/business-day';
import { RentalSettingsUseCases } from '../rental-settings/application/rental-settings.usecases';
import { RentalSettingsModule } from '../rental-settings/rental-settings.module';
import { FleetExpenseUseCases } from './application/fleet-expense.usecases';
import { MaintenanceLogUseCases } from './application/maintenance-log.usecases';
import { MaintenancePlanUseCases } from './application/maintenance-plan.usecases';
import { MaintenanceStatusUseCases } from './application/maintenance-status.usecases';
import {
  AUTOMATIC_EXPENSE_SOURCE,
  FLEET_EXPENSE_REPOSITORY,
} from './application/ports/fleet-expense.repository';
import type {
  AutomaticExpenseSource,
  FleetExpenseRepository,
} from './application/ports/fleet-expense.repository';
import { FLEET_EXPENSES_READER } from './application/ports/fleet-expenses-reader';
import { FLEET_SNAPSHOT_SOURCE } from './application/ports/fleet-snapshot.source';
import type { FleetSnapshotSource } from './application/ports/fleet-snapshot.source';
import { MAINTENANCE_LOG_REPOSITORY } from './application/ports/maintenance-log.repository';
import type { MaintenanceLogRepository } from './application/ports/maintenance-log.repository';
import { MAINTENANCE_PLAN_REPOSITORY } from './application/ports/maintenance-plan.repository';
import type { MaintenancePlanRepository } from './application/ports/maintenance-plan.repository';
import { MAINTENANCE_SETTINGS_SOURCE } from './application/ports/maintenance-settings';
import type { MaintenanceSettingsSource } from './application/ports/maintenance-settings';
import { PrismaAutomaticExpenseSource } from './infrastructure/prisma-automatic-expense.source';
import { PrismaFleetExpenseRepository } from './infrastructure/prisma-fleet-expense.repository';
import { PrismaFleetSnapshotSource } from './infrastructure/prisma-fleet-snapshot.source';
import { PrismaMaintenanceLogRepository } from './infrastructure/prisma-maintenance-log.repository';
import { PrismaMaintenancePlanRepository } from './infrastructure/prisma-maintenance-plan.repository';
import { RentalSettingsMaintenanceSource } from './infrastructure/rental-settings-maintenance.source';
import { FleetExpensesController } from './presentation/fleet-expenses.controller';
import { FleetMaintenanceController } from './presentation/fleet-maintenance.controller';

/** Hoy en la zona del taller: el día que cuentan los días desde el último servicio. */
const businessToday = (): string => businessDateOf(new Date());

/**
 * Mantenimiento de la flota y gastos por carro (099). Lee la flota, las rentas,
 * las multas y los lavados del carwash directo con Prisma; no importa `fleet`,
 * `rentals` ni `carwash`.
 *
 * Exporta `FLEET_EXPENSES_READER` (puerto `FleetExpensesReader`): los gastos de
 * un carro con sus tres orígenes, para la rentabilidad (100).
 */
@Module({
  imports: [RentalSettingsModule],
  controllers: [FleetMaintenanceController, FleetExpensesController],
  providers: [
    { provide: MAINTENANCE_PLAN_REPOSITORY, useClass: PrismaMaintenancePlanRepository },
    { provide: MAINTENANCE_LOG_REPOSITORY, useClass: PrismaMaintenanceLogRepository },
    { provide: FLEET_SNAPSHOT_SOURCE, useClass: PrismaFleetSnapshotSource },
    { provide: FLEET_EXPENSE_REPOSITORY, useClass: PrismaFleetExpenseRepository },
    { provide: AUTOMATIC_EXPENSE_SOURCE, useClass: PrismaAutomaticExpenseSource },
    {
      provide: MAINTENANCE_SETTINGS_SOURCE,
      useFactory: (settings: RentalSettingsUseCases) =>
        new RentalSettingsMaintenanceSource(settings),
      inject: [RentalSettingsUseCases],
    },
    {
      provide: MaintenancePlanUseCases,
      useFactory: (plan: MaintenancePlanRepository) => new MaintenancePlanUseCases(plan),
      inject: [MAINTENANCE_PLAN_REPOSITORY],
    },
    {
      provide: MaintenanceLogUseCases,
      useFactory: (
        logs: MaintenanceLogRepository,
        plan: MaintenancePlanRepository,
        fleet: FleetSnapshotSource,
      ) => new MaintenanceLogUseCases(logs, plan, fleet, businessToday),
      inject: [MAINTENANCE_LOG_REPOSITORY, MAINTENANCE_PLAN_REPOSITORY, FLEET_SNAPSHOT_SOURCE],
    },
    {
      provide: MaintenanceStatusUseCases,
      useFactory: (
        fleet: FleetSnapshotSource,
        plan: MaintenancePlanRepository,
        logs: MaintenanceLogRepository,
        settings: MaintenanceSettingsSource,
      ) => new MaintenanceStatusUseCases(fleet, plan, logs, settings, businessToday),
      inject: [
        FLEET_SNAPSHOT_SOURCE,
        MAINTENANCE_PLAN_REPOSITORY,
        MAINTENANCE_LOG_REPOSITORY,
        MAINTENANCE_SETTINGS_SOURCE,
      ],
    },
    {
      provide: FleetExpenseUseCases,
      useFactory: (
        expenses: FleetExpenseRepository,
        automatic: AutomaticExpenseSource,
        fleet: FleetSnapshotSource,
      ) => new FleetExpenseUseCases(expenses, automatic, fleet),
      inject: [FLEET_EXPENSE_REPOSITORY, AUTOMATIC_EXPENSE_SOURCE, FLEET_SNAPSHOT_SOURCE],
    },
    { provide: FLEET_EXPENSES_READER, useExisting: FleetExpenseUseCases },
  ],
  exports: [FLEET_EXPENSES_READER],
})
export class FleetMaintenanceModule {}
