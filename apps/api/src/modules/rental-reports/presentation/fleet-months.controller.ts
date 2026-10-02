import { API_ERROR_CODES, PERMISSIONS, monthsQuerySchema } from '@elite/shared';
import type { MonthsQuery, VehicleMonths } from '@elite/shared';
import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Query } from '@nestjs/common';

import { RequirePermissions } from '../../../common/auth/auth.decorators';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { RentalReportsUseCases } from '../application/rental-reports.usecases';

const idPipe = new ParseUUIDPipe({
  exceptionFactory: () =>
    new NotFoundException({ code: API_ERROR_CODES.NOT_FOUND, message: 'Ese carro no existe.' }),
});

/** La pestaña «Meses» de la ficha de un carro (100): `rentals.reports`. */
@Controller('fleet/vehicles')
export class FleetMonthsController {
  constructor(private readonly reportsUseCases: RentalReportsUseCases) {}

  @Get(':id/months')
  @RequirePermissions(PERMISSIONS.rentals.actions.reports.key)
  months(
    @Param('id', idPipe) id: string,
    @Query(new ZodValidationPipe(monthsQuerySchema)) query: MonthsQuery,
  ): Promise<VehicleMonths> {
    return this.reportsUseCases.months(id, query);
  }
}
