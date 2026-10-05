import { PERMISSIONS, profitabilityQuerySchema } from '@elite/shared';
import type { ProfitabilityQuery, ProfitabilityReport, RentalToday } from '@elite/shared';
import { Controller, Get, Query } from '@nestjs/common';

import { RequirePermissions } from '../../../common/auth/auth.decorators';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { RentalReportsUseCases } from '../application/rental-reports.usecases';

const { read, reports } = PERMISSIONS.rentals.actions;

/** Hoy (`rentals.read`, 107) y la rentabilidad (`rentals.reports`, 100). */
@Controller('rentals/reports')
export class RentalReportsController {
  constructor(private readonly reportsUseCases: RentalReportsUseCases) {}

  @Get('today')
  @RequirePermissions(read.key)
  today(): Promise<RentalToday> {
    return this.reportsUseCases.today();
  }

  @Get('profitability')
  @RequirePermissions(reports.key)
  profitability(
    @Query(new ZodValidationPipe(profitabilityQuerySchema)) query: ProfitabilityQuery,
  ): Promise<ProfitabilityReport> {
    return this.reportsUseCases.profitability(query);
  }
}
