import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './common/prisma/prisma.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/presentation/jwt-auth.guard';
import { BankingModule } from './modules/banking/banking.module';
import { AuthorizationGuard } from './modules/auth/presentation/authorization.guard';
import { PermissionsGuard } from './modules/auth/presentation/permissions.guard';
import { CarwashModule } from './modules/carwash/carwash.module';
import { CombosModule } from './modules/combos/combos.module';
import { CustomersModule } from './modules/customers/customers.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { FloorAuthGuard } from './modules/employees/presentation/floor-auth.guard';
import { FleetModule } from './modules/fleet/fleet.module';
import { FleetMaintenanceModule } from './modules/fleet-maintenance/fleet-maintenance.module';
import { HealthModule } from './modules/health/health.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { RentalBillingModule } from './modules/rental-billing/rental-billing.module';
import { RentalFilesModule } from './modules/rental-files/rental-files.module';
import { RentalReportsModule } from './modules/rental-reports/rental-reports.module';
import { RentalSettingsModule } from './modules/rental-settings/rental-settings.module';
import { RentalsModule } from './modules/rentals/rentals.module';
import { RentersModule } from './modules/renters/renters.module';
import { RolesModule } from './modules/roles/roles.module';
import { SalesModule } from './modules/sales/sales.module';
import { ServicesModule } from './modules/services/services.module';
import { TabsModule } from './modules/tabs/tabs.module';
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
    CombosModule,
    CarwashModule,
    InventoryModule,
    SalesModule,
    // Cuentas abiertas (105): lo que se lleva alguien y paga despues.
    TabsModule,
    BankingModule,
    // Renta de carros (095): los cuatro completos y los cascarones de 096-100,
    // registrados ya para que las specs paralelas no editen este archivo.
    FleetModule,
    RentersModule,
    RentalSettingsModule,
    RentalFilesModule,
    RentalsModule,
    RentalBillingModule,
    FleetMaintenanceModule,
    RentalReportsModule,
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
    // Anular y deshacer cobro piden ademas la firma de alguien con el permiso
    // (045). Va al final de los tres: primero sesion, despues el permiso del
    // que esta adelante, y solo entonces las credenciales del que autoriza.
    {
      provide: APP_GUARD,
      useExisting: AuthorizationGuard,
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
