import { Module } from '@nestjs/common';

import { GetHealthUseCase, systemHealthClock } from './application/get-health.usecase';
import { HealthController } from './presentation/health.controller';

/**
 * El módulo es el único punto donde se cablean las dependencias:
 * el caso de uso queda libre de decoradores de NestJS.
 */
@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: GetHealthUseCase,
      useFactory: (): GetHealthUseCase => new GetHealthUseCase(systemHealthClock),
    },
  ],
})
export class HealthModule {}
