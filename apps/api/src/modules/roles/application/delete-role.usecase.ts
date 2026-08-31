import { ConflictException, NotFoundException } from '@nestjs/common';
import { API_ERROR_CODES } from '@elite/shared';

import { isRoleInUse } from '../domain/role';
import type { RoleRepository } from './ports/role.repository';

/**
 * Elimina un rol.
 *
 * RN-6: si tiene usuarios asignados no se elimina. Se verifica aca y se
 * responde `409 ROLE_IN_USE`, en vez de dejar que reviente la restriccion de
 * la base.
 */
export class DeleteRoleUseCase {
  constructor(private readonly roles: RoleRepository) {}

  async execute(id: string): Promise<void> {
    const role = await this.roles.findById(id);

    if (role === null) {
      throw new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese rol no existe.',
      });
    }

    if (isRoleInUse(role)) {
      throw new ConflictException({
        code: API_ERROR_CODES.ROLE_IN_USE,
        message: 'Ese rol tiene usuarios asignados, así que no se puede eliminar.',
        details: { userCount: role.userCount },
      });
    }

    await this.roles.deleteById(id);
  }
}
