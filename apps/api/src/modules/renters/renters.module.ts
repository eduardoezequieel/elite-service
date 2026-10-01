import { Module } from '@nestjs/common';

import { RENTER_REPOSITORY } from './application/ports/renter.repository';
import type { RenterRepository } from './application/ports/renter.repository';
import { RenterUseCases } from './application/renter.usecases';
import { PrismaRenterRepository } from './infrastructure/prisma-renter.repository';
import { RentersController } from './presentation/renters.controller';

/**
 * Clientes de renta (095). Exporta el caso de uso para que las rentas (096)
 * lean al arrendatario sin armar su propio repositorio.
 */
@Module({
  controllers: [RentersController],
  providers: [
    { provide: RENTER_REPOSITORY, useClass: PrismaRenterRepository },
    {
      provide: RenterUseCases,
      useFactory: (renters: RenterRepository): RenterUseCases => new RenterUseCases(renters),
      inject: [RENTER_REPOSITORY],
    },
  ],
  exports: [RenterUseCases],
})
export class RentersModule {}
