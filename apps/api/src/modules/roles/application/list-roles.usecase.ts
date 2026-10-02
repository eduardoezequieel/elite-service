import type { Page, RoleDetail, RolesQuery } from '@elite/shared';

import type { RoleRepository } from './ports/role.repository';
import { toRoleDetail } from './role-detail.mapper';

/**
 * Lista los roles con sus permisos y su numero de usuarios, de a una pagina
 * (spec 102).
 */
export class ListRolesUseCase {
  constructor(private readonly roles: RoleRepository) {}

  async execute(query: RolesQuery): Promise<Page<RoleDetail>> {
    const page = await this.roles.findPage(query);

    return { ...page, items: page.items.map(toRoleDetail) };
  }
}
