import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { CreateEmployeeUseCase } from './application/create-employee.usecase';
import { FloorLoginUseCase } from './application/floor-login.usecase';
import { ListEmployeesUseCase } from './application/list-employees.usecase';
import { EMPLOYEE_REPOSITORY } from './application/ports/employee.repository';
import type { EmployeeRepository } from './application/ports/employee.repository';
import { FLOOR_TOKEN_ISSUER } from './application/ports/floor-token-issuer';
import type { FloorTokenIssuer } from './application/ports/floor-token-issuer';
import { PIN_HASHER } from './application/ports/pin.hasher';
import type { PinHasher } from './application/ports/pin.hasher';
import { UpdateEmployeeUseCase } from './application/update-employee.usecase';
import { BcryptPinHasher } from './infrastructure/bcrypt-pin.hasher';
import { JwtFloorTokenIssuer } from './infrastructure/jwt-floor-token.issuer';
import { PrismaEmployeeRepository } from './infrastructure/prisma-employee.repository';
import { EmployeesController } from './presentation/employees.controller';
import { FloorAuthController } from './presentation/floor-auth.controller';
import { FloorCookieService } from './presentation/floor-cookie.service';

/**
 * Empleados y sesion de pista.
 *
 * Los dos controllers viven en el mismo modulo porque comparten repositorio,
 * pero atienden mundos distintos: `EmployeesController` es oficina y se
 * autoriza por permisos; `FloorAuthController` es pista y no tiene permisos que
 * consultar (RN-0).
 *
 * Exporta el repositorio y el emisor de token porque el guard de pista se
 * registra global en `AppModule` y los necesita.
 */
@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [EmployeesController, FloorAuthController],
  providers: [
    FloorCookieService,
    { provide: EMPLOYEE_REPOSITORY, useClass: PrismaEmployeeRepository },
    { provide: PIN_HASHER, useClass: BcryptPinHasher },
    { provide: FLOOR_TOKEN_ISSUER, useClass: JwtFloorTokenIssuer },
    {
      provide: FloorLoginUseCase,
      useFactory: (
        employees: EmployeeRepository,
        pins: PinHasher,
        tokens: FloorTokenIssuer,
      ): FloorLoginUseCase => new FloorLoginUseCase(employees, pins, tokens),
      inject: [EMPLOYEE_REPOSITORY, PIN_HASHER, FLOOR_TOKEN_ISSUER],
    },
    {
      provide: ListEmployeesUseCase,
      useFactory: (employees: EmployeeRepository): ListEmployeesUseCase =>
        new ListEmployeesUseCase(employees),
      inject: [EMPLOYEE_REPOSITORY],
    },
    {
      provide: CreateEmployeeUseCase,
      useFactory: (employees: EmployeeRepository, pins: PinHasher): CreateEmployeeUseCase =>
        new CreateEmployeeUseCase(employees, pins),
      inject: [EMPLOYEE_REPOSITORY, PIN_HASHER],
    },
    {
      provide: UpdateEmployeeUseCase,
      useFactory: (employees: EmployeeRepository, pins: PinHasher): UpdateEmployeeUseCase =>
        new UpdateEmployeeUseCase(employees, pins),
      inject: [EMPLOYEE_REPOSITORY, PIN_HASHER],
    },
  ],
  exports: [EMPLOYEE_REPOSITORY, FLOOR_TOKEN_ISSUER],
})
export class EmployeesModule {}
