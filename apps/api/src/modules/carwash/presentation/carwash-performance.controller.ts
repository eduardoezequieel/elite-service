import { API_ERROR_CODES, PERMISSIONS, performanceQuerySchema } from '@elite/shared';
import type { PerformanceEmployeeDetail, PerformanceQuery, PerformanceReport } from '@elite/shared';
import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Query } from '@nestjs/common';

import { RequirePermissions } from '../../../common/auth/auth.decorators';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { PerformanceUseCases } from '../application/performance.usecases';

/**
 * Rendimiento del lavado (067). Mismo permiso que Comisiones: la pantalla la
 * reemplaza y la pestaña Comisiones sigue leyendo los endpoints de la 009.
 */
@Controller('carwash/performance')
export class CarwashPerformanceController {
  private static readonly employeeId = new ParseUUIDPipe({
    exceptionFactory: () =>
      new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese empleado no existe.',
      }),
  });

  constructor(private readonly performance: PerformanceUseCases) {}

  @Get()
  @RequirePermissions(PERMISSIONS.carwash.actions.commissions.key)
  report(
    @Query(new ZodValidationPipe(performanceQuerySchema)) query: PerformanceQuery,
  ): Promise<PerformanceReport> {
    return this.performance.report(query);
  }

  @Get(':employeeId')
  @RequirePermissions(PERMISSIONS.carwash.actions.commissions.key)
  employee(
    @Param('employeeId', CarwashPerformanceController.employeeId) employeeId: string,
    @Query(new ZodValidationPipe(performanceQuerySchema)) query: PerformanceQuery,
  ): Promise<PerformanceEmployeeDetail> {
    return this.performance.employee(employeeId, query);
  }
}
