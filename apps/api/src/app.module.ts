import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './common/prisma/prisma.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/presentation/jwt-auth.guard';
import { PermissionsGuard } from './modules/auth/presentation/permissions.guard';
import { HealthModule } from './modules/health/health.module';
import { RolesModule } from './modules/roles/roles.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    // Las variables viven en el .env de la RAÍZ del monorepo; el .env local
    // (opcional, no versionado) sólo sirve para overrides puntuales.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    PrismaModule,
    AuthModule,
    HealthModule,
    RolesModule,
    UsersModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    // El orden importa: los APP_GUARD corren en orden de registro.
    // Primero se resuelve la sesión, después se evalúan los permisos.
    //
    // Van con `useExisting` y no con `useClass`: los guards ya están
    // construidos dentro de AuthModule, con sus puertos resueltos ahí. Con
    // `useClass`, Nest intentaría resolverlos en el injector de AppModule y
    // fallaría.
    {
      provide: APP_GUARD,
      useExisting: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useExisting: PermissionsGuard,
    },
  ],
})
export class AppModule {}
