import { API_ERROR_CODES } from '@elite/shared';
import type { CreateUserInput, PublicUser } from '@elite/shared';
import { ConflictException } from '@nestjs/common';

import { assertRolesExist } from './assert-roles-exist';
import type { PasswordHasher } from './ports/password.hasher';
import type { RoleDirectory } from './ports/role.directory';
import type { UserRepository } from './ports/user.repository';
import { toPublicUser } from './public-user.mapper';

/**
 * `POST /users`. Requiere `users.manage` (lo exige el decorador del
 * controller, nunca este caso de uso).
 *
 * El correo llega ya normalizado en minúsculas por el schema Zod compartido,
 * así que la unicidad se compara sobre el valor guardado.
 */
export class CreateUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly roles: RoleDirectory,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(input: CreateUserInput): Promise<PublicUser> {
    if (await this.users.existsByEmail(input.email)) {
      throw new ConflictException({
        code: API_ERROR_CODES.EMAIL_TAKEN,
        message: 'Ya hay un usuario con ese correo.',
      });
    }

    await assertRolesExist(this.roles, input.roleIds);

    const created = await this.users.create({
      email: input.email,
      fullName: input.fullName,
      // La contraseña se hashea acá y no vuelve a salir nunca (RN-7).
      passwordHash: await this.hasher.hash(input.password),
      roleIds: [...input.roleIds],
    });

    return toPublicUser(created);
  }
}
