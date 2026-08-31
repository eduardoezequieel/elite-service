import type { RoleDetail } from '@elite/shared';

import type { RoleRepository } from './ports/role.repository';
import { toRoleDetail } from './role-detail.mapper';

/**
 * Lista todos los roles con sus permisos y su numero de usuarios.
 *
 * Sin paginacion en v1: la coleccion se devuelve completa, tal como lo declara
 * la spec 001.
 */
export class ListRolesUseCase {
  constructor(private readonly roles: RoleRepository) {}

  async execute(): Promise<RoleDetail[]> {
    const roles = await this.roles.findAll();

    return roles.map(toRoleDetail);
  }
}
