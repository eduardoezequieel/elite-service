import { API_ERROR_CODES } from '@elite/shared';

import { ConflictError, NotFoundError } from '../../../common/errors/application-error';
import { isDeletionProtected, isRoleInUse } from '../domain/role';
import type { RoleRepository } from './ports/role.repository';

/**
 * Elimina un rol.
 *
 * RN-6: si tiene usuarios asignados no se elimina. Se verifica aca y se
 * responde `409 ROLE_IN_USE`, en vez de dejar que reviente la restriccion de
 * la base. El rol del sistema no se elimina nunca: `409 SYSTEM_ROLE_PROTECTED`
 * (spec 074).
 */
export class DeleteRoleUseCase {
  constructor(private readonly roles: RoleRepository) {}

  async execute(id: string): Promise<void> {
    const role = await this.roles.findById(id);

    if (role === null) {
      throw new NotFoundError({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese rol no existe.',
      });
    }

    // Antes que RN-6: el rol del sistema casi siempre tiene usuarios, y el
    // motivo real es otro (spec 074).
    if (isDeletionProtected(role)) {
      throw new ConflictError({
        code: API_ERROR_CODES.SYSTEM_ROLE_PROTECTED,
        message: 'Ese es el rol del sistema, así que no se puede eliminar.',
      });
    }

    if (isRoleInUse(role)) {
      throw new ConflictError({
        code: API_ERROR_CODES.ROLE_IN_USE,
        message: 'Ese rol tiene usuarios asignados, así que no se puede eliminar.',
        details: { userCount: role.userCount },
      });
    }

    await this.roles.deleteById(id);
  }
}
