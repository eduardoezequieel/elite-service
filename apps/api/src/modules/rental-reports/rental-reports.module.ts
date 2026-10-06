import { Module } from '@nestjs/common';

import { FLEET_EXPENSES_READER } from '../fleet-maintenance/application/ports/fleet-expenses-reader';
import type { FleetExpensesReader } from '../fleet-maintenance/application/ports/fleet-expenses-reader';
import { FleetMaintenanceModule } from '../fleet-maintenance/fleet-maintenance.module';
import { RentalSettingsUseCases } from '../rental-settings/application/rental-settings.usecases';
import { RentalSettingsModule } from '../rental-settings/rental-settings.module';
import {
  RENTAL_REPORTS_SOURCE,
  REPORT_SETTINGS_SOURCE,
} from './application/ports/rental-reports.source';
import type {
  RentalReportsSource,
  ReportSettingsSource,
} from './application/ports/rental-reports.source';
import { RentalReportsUseCases } from './application/rental-reports.usecases';
import { PrismaRentalReportsSource } from './infrastructure/prisma-rental-reports.source';
import { RentalSettingsReportSource } from './infrastructure/rental-settings-report.source';
import { FleetMonthsController } from './presentation/fleet-months.controller';
import { RentalReportsController } from './presentation/rental-reports.controller';

/**
 * Hoy y rentabilidad por carro (100, 107). Lee flota, rentas,
 * pagos, multas y plan directo con Prisma; los gastos salen del puerto
 * `FleetExpensesReader` que exporta `FleetMaintenanceModule` (099).
 */
@Module({
  imports: [FleetMaintenanceModule, RentalSettingsModule],
  controllers: [RentalReportsController, FleetMonthsController],
  providers: [
    { provide: RENTAL_REPORTS_SOURCE, useClass: PrismaRentalReportsSource },
    {
      provide: REPORT_SETTINGS_SOURCE,
      useFactory: (settings: RentalSettingsUseCases) => new RentalSettingsReportSource(settings),
      inject: [RentalSettingsUseCases],
    },
    {
      provide: RentalReportsUseCases,
      useFactory: (
        source: RentalReportsSource,
        expenses: FleetExpensesReader,
        settings: ReportSettingsSource,
      ) => new RentalReportsUseCases(source, expenses, settings),
      inject: [RENTAL_REPORTS_SOURCE, FLEET_EXPENSES_READER, REPORT_SETTINGS_SOURCE],
    },
  ],
})
export class RentalReportsModule {}
