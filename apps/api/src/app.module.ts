import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './common/prisma/prisma.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/presentation/jwt-auth.guard';
import { PermissionsGuard } from './modules/auth/presentation/permissions.guard';
import { CarwashModule } from './modules/carwash/carwash.module';
import { CustomersModule } from './modules/customers/customers.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { FloorAuthGuard } from './modules/employees/presentation/floor-auth.guard';
import { HealthModule } from './modules/health/health.module';
import { RolesModule } from './modules/roles/roles.module';
import { ServicesModule } from './modules/services/services.module';
import { UsersModule } from './modules/users/users.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';

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
    EmployeesModule,
    CustomersModule,
    VehiclesModule,
    ServicesModule,
    CarwashModule,
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
    // El guard de pista (spec 003, RN-19) atiende solo las rutas marcadas con
    // `@FloorSession()`; sobre el resto no opina. Va despues de los de oficina
    // porque son excluyentes: una ruta es de un mundo o del otro, nunca de los
    // dos.
    FloorAuthGuard,
    {
      provide: APP_GUARD,
      useExisting: FloorAuthGuard,
    },
  ],
})
export class AppModule {}
