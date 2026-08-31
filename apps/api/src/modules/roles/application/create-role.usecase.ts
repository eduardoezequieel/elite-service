import { ConflictException } from '@nestjs/common';
import { API_ERROR_CODES, type CreateRoleInput, type RoleDetail } from '@elite/shared';

import { normalizePermissionKeys } from '../domain/role';
import { assertPermissionKeysExist } from './permission-keys';
import type { RoleRepository } from './ports/role.repository';
import { toRoleDetail } from './role-detail.mapper';

/**
 * Crea un rol, con permisos o sin ninguno: un rol vacio es valido y sus
 * permisos se asignan despues sin recrearlo (RN-6b).
 */
export class CreateRoleUseCase {
  constructor(private readonly roles: RoleRepository) {}

  async execute(input: CreateRoleInput): Promise<RoleDetail> {
    const permissionKeys = normalizePermissionKeys(input.permissionKeys);

    assertPermissionKeysExist(permissionKeys);

    const existing = await this.roles.findByName(input.name);

    if (existing !== null) {
      throw new ConflictException({
        code: API_ERROR_CODES.NAME_TAKEN,
        message: 'Ya existe un rol con ese nombre.',
      });
    }

    const role = await this.roles.create({
      name: input.name,
      description: input.description ?? null,
      permissionKeys,
    });

    return toRoleDetail(role);
  }
}
