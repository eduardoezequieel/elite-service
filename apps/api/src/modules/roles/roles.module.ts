import { Module } from '@nestjs/common';

import { CreateRoleUseCase } from './application/create-role.usecase';
import { DeleteRoleUseCase } from './application/delete-role.usecase';
import { ListPermissionsUseCase } from './application/list-permissions.usecase';
import { ListRolesUseCase } from './application/list-roles.usecase';
import { ROLE_REPOSITORY, type RoleRepository } from './application/ports/role.repository';
import { UpdateRoleUseCase } from './application/update-role.usecase';
import { PrismaRoleRepository } from './infrastructure/prisma-role.repository';
import { PermissionsController } from './presentation/permissions.controller';
import { RolesController } from './presentation/roles.controller';

/**
 * Unico punto donde se cablean las dependencias del modulo: el puerto
 * `RoleRepository` se resuelve a la implementacion con Prisma y los casos de
 * uso quedan libres de decoradores de NestJS.
 */
@Module({
  controllers: [RolesController, PermissionsController],
  providers: [
    { provide: ROLE_REPOSITORY, useClass: PrismaRoleRepository },
    {
      provide: ListRolesUseCase,
      useFactory: (roles: RoleRepository): ListRolesUseCase => new ListRolesUseCase(roles),
      inject: [ROLE_REPOSITORY],
    },
    {
      provide: CreateRoleUseCase,
      useFactory: (roles: RoleRepository): CreateRoleUseCase => new CreateRoleUseCase(roles),
      inject: [ROLE_REPOSITORY],
    },
    {
      provide: UpdateRoleUseCase,
      useFactory: (roles: RoleRepository): UpdateRoleUseCase => new UpdateRoleUseCase(roles),
      inject: [ROLE_REPOSITORY],
    },
    {
      provide: DeleteRoleUseCase,
      useFactory: (roles: RoleRepository): DeleteRoleUseCase => new DeleteRoleUseCase(roles),
      inject: [ROLE_REPOSITORY],
    },
    {
      provide: ListPermissionsUseCase,
      useFactory: (): ListPermissionsUseCase => new ListPermissionsUseCase(),
    },
  ],
})
export class RolesModule {}
