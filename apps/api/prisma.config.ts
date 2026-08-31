import path from 'node:path';

import { config as loadEnv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

/**
 * Configuracion del CLI de Prisma (migraciones, seed, studio).
 *
 * Desde Prisma 7 la URL de la base ya no vive en `schema.prisma`. Las
 * migraciones la leen de aca y el cliente la recibe por el adaptador de
 * `@prisma/adapter-pg` (ver `infrastructure/prisma.service.ts`).
 *
 * El `.env` canonico del monorepo vive en la raiz, no en `apps/api`, asi que se
 * carga a mano antes de resolver las variables.
 */
loadEnv({ path: path.resolve(__dirname, '../../.env') });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    seed: 'ts-node --compiler-options {"module":"CommonJS"} prisma/seed.ts',
  },
});
