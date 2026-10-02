import { PERMISSIONS, profitabilityQuerySchema } from '@elite/shared';
import type { ProfitabilityQuery, ProfitabilityReport, RentalDashboard } from '@elite/shared';
import { Controller, Get, Query } from '@nestjs/common';

import { RequirePermissions } from '../../../common/auth/auth.decorators';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { RentalReportsUseCases } from '../application/rental-reports.usecases';

const { read, reports } = PERMISSIONS.rentals.actions;

/** El inicio (`rentals.read`) y la rentabilidad (`rentals.reports`) de la rentadora (100). */
@Controller('rentals/reports')
export class RentalReportsController {
  constructor(private readonly reportsUseCases: RentalReportsUseCases) {}

  @Get('dashboard')
  @RequirePermissions(read.key)
  dashboard(): Promise<RentalDashboard> {
    return this.reportsUseCases.dashboard();
  }

  @Get('profitability')
  @RequirePermissions(reports.key)
  profitability(
    @Query(new ZodValidationPipe(profitabilityQuerySchema)) query: ProfitabilityQuery,
  ): Promise<ProfitabilityReport> {
    return this.reportsUseCases.profitability(query);
  }
}
