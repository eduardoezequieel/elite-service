import { Controller, Get } from '@nestjs/common';

import { GetHealthUseCase } from '../application/get-health.usecase';
import type { HealthResult } from '../application/get-health.usecase';

/**
 * Capa `presentation`: sólo traduce HTTP <-> caso de uso.
 * Prohibido poner lógica de negocio aquí.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly getHealth: GetHealthUseCase) {}

  @Get()
  handle(): HealthResult {
    return this.getHealth.execute();
  }
}
