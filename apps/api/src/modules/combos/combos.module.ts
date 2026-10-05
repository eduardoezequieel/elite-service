import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { ComboUseCases } from './application/combo.usecases';
import { COMBO_REPOSITORY } from './application/ports/combo.repository';
import type { ComboRepository } from './application/ports/combo.repository';
import { PrismaComboRepository } from './infrastructure/prisma-combo.repository';
import { CombosController } from './presentation/combos.controller';

/**
 * Combos del lavado (104). Exporta `ComboUseCases`: el lavado lo adapta a su
 * puerto `ComboCatalog` para listar los de hoy y expandirlos en líneas.
 */
@Module({
  imports: [PrismaModule],
  controllers: [CombosController],
  providers: [
    { provide: COMBO_REPOSITORY, useClass: PrismaComboRepository },
    {
      provide: ComboUseCases,
      useFactory: (combos: ComboRepository): ComboUseCases => new ComboUseCases(combos),
      inject: [COMBO_REPOSITORY],
    },
  ],
  exports: [ComboUseCases],
})
export class CombosModule {}
