import { Controller, Get } from '@nestjs/common';

import { Public } from '../../../common/auth/auth.decorators';
import { GetHealthUseCase } from '../application/get-health.usecase';
import type { HealthResult } from '../application/get-health.usecase';

/**
 * Capa `presentation`: sólo traduce HTTP <-> caso de uso.
 * Prohibido poner lógica de negocio aquí.
 */
// El health check es publico: lo consultan el monitoreo y docker compose,
// que no tienen sesion.
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly getHealth: GetHealthUseCase) {}

  @Get()
  handle(): HealthResult {
    return this.getHealth.execute();
  }
}
