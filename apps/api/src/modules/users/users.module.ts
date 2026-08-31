import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { CreateUserUseCase } from './application/create-user.usecase';
import { ListUsersUseCase } from './application/list-users.usecase';
import type { PasswordHasher } from './application/ports/password.hasher';
import type { RoleDirectory } from './application/ports/role.directory';
import type { UserRepository } from './application/ports/user.repository';
import { UpdateUserUseCase } from './application/update-user.usecase';
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password.hasher';
import { PrismaRoleDirectory } from './infrastructure/prisma-role.directory';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';
import { UsersController } from './presentation/users.controller';

/**
 * Tokens de inyección de los puertos. Hacen falta porque un puerto es una
 * interfaz de TypeScript y no existe en tiempo de ejecución.
 */
export const USER_REPOSITORY = Symbol('users.UserRepository');
export const ROLE_DIRECTORY = Symbol('users.RoleDirectory');
export const PASSWORD_HASHER = Symbol('users.PasswordHasher');

/**
 * Único punto donde se cablean las dependencias del módulo: los casos de uso
 * quedan libres de decoradores de Nest y reciben sus puertos por constructor.
 *
 * `PrismaModule` es global, pero se importa igual para que el módulo sea
 * autosuficiente si se monta en un test de integración.
 */
@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: ROLE_DIRECTORY, useClass: PrismaRoleDirectory },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    {
      provide: ListUsersUseCase,
      useFactory: (users: UserRepository): ListUsersUseCase => new ListUsersUseCase(users),
      inject: [USER_REPOSITORY],
    },
    {
      provide: CreateUserUseCase,
      useFactory: (
        users: UserRepository,
        roles: RoleDirectory,
        hasher: PasswordHasher,
      ): CreateUserUseCase => new CreateUserUseCase(users, roles, hasher),
      inject: [USER_REPOSITORY, ROLE_DIRECTORY, PASSWORD_HASHER],
    },
    {
      provide: UpdateUserUseCase,
      useFactory: (
        users: UserRepository,
        roles: RoleDirectory,
        hasher: PasswordHasher,
      ): UpdateUserUseCase => new UpdateUserUseCase(users, roles, hasher),
      inject: [USER_REPOSITORY, ROLE_DIRECTORY, PASSWORD_HASHER],
    },
  ],
})
export class UsersModule {}
