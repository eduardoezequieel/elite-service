import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Cliente de Prisma como provider de Nest.
 *
 * Desde Prisma 7 el cliente no lee la URL del esquema: recibe un adaptador de
 * driver. Aca se arma con `@prisma/adapter-pg` a partir de `DATABASE_URL`,
 * leida con `ConfigService` y nunca con `process.env` directo.
 *
 * Vive en `common/` porque lo comparten todos los modulos. Cada modulo lo usa
 * solo desde su capa `infrastructure/`, nunca desde `application/` ni `domain/`.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService) {
    const connectionString = config.get<string>('DATABASE_URL');

    if (connectionString === undefined || connectionString.trim() === '') {
      throw new Error('Falta DATABASE_URL. Revisa el .env de la raiz del monorepo.');
    }

    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Conectado a PostgreSQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
