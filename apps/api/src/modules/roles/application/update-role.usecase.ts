import { ConflictException, NotFoundException } from '@nestjs/common';
import { API_ERROR_CODES, type RoleDetail, type UpdateRoleInput } from '@elite/shared';

import type { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { locksRequesterOut, normalizePermissionKeys } from '../domain/role';
import { assertPermissionKeysExist } from './permission-keys';
import type { RoleRepository } from './ports/role.repository';
import { toRoleDetail } from './role-detail.mapper';

/**
 * Edita un rol.
 *
 * `permissionKeys` REEMPLAZA el conjunto completo de permisos del rol, sin
 * recrearlo ni tocar a los usuarios que lo tengan (RN-6b).
 *
 * Antes de guardar corre la puerta B del anti-lockout (RN-5): si el cambio
 * dejaria al propio solicitante sin `roles.manage`, responde
 * `409 SELF_LOCKOUT` y no cambia nada.
 */
export class UpdateRoleUseCase {
  constructor(private readonly roles: RoleRepository) {}

  async execute(id: string, input: UpdateRoleInput, requester: AuthenticatedUser): Promise<RoleDetail> {
    const role = await this.roles.findById(id);

    if (role === null) {
      throw new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese rol no existe.',
      });
    }

    if (input.name !== undefined) {
      await this.assertNameIsFree(input.name, id);
    }

    let permissionKeys: string[] | undefined;

    if (input.permissionKeys !== undefined) {
      permissionKeys = normalizePermissionKeys(input.permissionKeys);
      assertPermissionKeysExist(permissionKeys);
      await this.assertDoesNotLockRequesterOut(id, permissionKeys, requester);
    }

    const updated = await this.roles.update(id, {
      name: input.name,
      description: input.description,
      permissionKeys,
    });

    return toRoleDetail(updated);
  }

  /** El nombre de rol es unico; si ya lo usa otro rol, `409 NAME_TAKEN`. */
  private async assertNameIsFree(name: string, roleId: string): Promise<void> {
    const other = await this.roles.findByName(name);

    if (other !== null && other.id !== roleId) {
      throw new ConflictException({
        code: API_ERROR_CODES.NAME_TAKEN,
        message: 'Ya existe un rol con ese nombre.',
      });
    }
  }

  /**
   * RN-5, puerta B. La evaluacion es siempre sobre los permisos EFECTIVOS
   * resultantes del solicitante —la union de todos sus roles despues del
   * cambio—, nunca sobre nombres de rol.
   */
  private async assertDoesNotLockRequesterOut(
    roleId: string,
    nextPermissionKeys: string[],
    requester: AuthenticatedUser,
  ): Promise<void> {
    const requesterRoleIds = requester.roles.map((assigned) => assigned.id);

    if (!requesterRoleIds.includes(roleId)) {
      return;
    }

    const otherRoleIds = requesterRoleIds.filter((assignedId) => assignedId !== roleId);
    const permissionsFromOtherRoles = await this.roles.findPermissionKeysByRoleIds(otherRoleIds);

    const locksOut = locksRequesterOut({
      requesterRoleIds,
      roleId,
      permissionsFromOtherRoles,
      nextPermissionKeys,
    });

    if (locksOut) {
      throw new ConflictException({
        code: API_ERROR_CODES.SELF_LOCKOUT,
        message: 'Ese cambio te dejaría sin la administración de roles, así que no se aplicó.',
      });
    }
  }
}
