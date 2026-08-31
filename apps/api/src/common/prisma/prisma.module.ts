import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/**
 * Modulo global del cliente de Prisma: lo importa el `AppModule` una sola vez y
 * queda disponible para la capa `infrastructure/` de cualquier modulo.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
