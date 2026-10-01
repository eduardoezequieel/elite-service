import { Module } from '@nestjs/common';

import {
  LOGO_FILE_LOOKUP,
  RENTAL_SETTINGS_REPOSITORY,
} from './application/ports/rental-settings.repository';
import type {
  LogoFileLookup,
  RentalSettingsRepository,
} from './application/ports/rental-settings.repository';
import { RentalSettingsUseCases } from './application/rental-settings.usecases';
import { PrismaLogoFileLookup } from './infrastructure/prisma-logo-file.lookup';
import { PrismaRentalSettingsRepository } from './infrastructure/prisma-rental-settings.repository';
import { RentalSettingsController } from './presentation/rental-settings.controller';

/**
 * Ajustes de la rentadora (095). Exporta el caso de uso: las rentas (096) leen
 * de acá las horas de gracia, el margen entre rentas y el IVA.
 */
@Module({
  controllers: [RentalSettingsController],
  providers: [
    { provide: RENTAL_SETTINGS_REPOSITORY, useClass: PrismaRentalSettingsRepository },
    { provide: LOGO_FILE_LOOKUP, useClass: PrismaLogoFileLookup },
    {
      provide: RentalSettingsUseCases,
      useFactory: (settings: RentalSettingsRepository, logos: LogoFileLookup) =>
        new RentalSettingsUseCases(settings, logos),
      inject: [RENTAL_SETTINGS_REPOSITORY, LOGO_FILE_LOOKUP],
    },
  ],
  exports: [RentalSettingsUseCases],
})
export class RentalSettingsModule {}
