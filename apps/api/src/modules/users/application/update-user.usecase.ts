import { API_ERROR_CODES, PERMISSIONS } from '@elite/shared';
import type { PublicUser, UpdateUserInput } from '@elite/shared';
import { ConflictException, NotFoundException } from '@nestjs/common';

import { locksOutSelf } from '../domain/self-lockout.rule';
import type { User } from '../domain/user';
import { assertRolesExist } from './assert-roles-exist';
import type { PasswordHasher } from './ports/password.hasher';
import type { RoleDirectory } from './ports/role.directory';
import type { UserChanges, UserRepository } from './ports/user.repository';
import { toPublicUser } from './public-user.mapper';

/** Lo que hace falta para resolver `PATCH /users/:id`. */
export interface UpdateUserCommand {
  /** El usuario que se edita. */
  userId: string;
  /** Quién pide el cambio: sólo importa para la puerta A del anti-lockout. */
  requesterId: string;
  input: UpdateUserInput;
}

/**
 * `PATCH /users/:id`. Requiere `users.manage`.
 *
 * También reemplaza la contraseña de **otro** (spec 001 RN-10). El cambio
 * propio vive en `POST /auth/password` (spec 006). No existe endpoint DELETE:
 * para dar de baja a alguien se manda `isActive: false` (RN-4).
 */
export class UpdateUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly roles: RoleDirectory,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(command: UpdateUserCommand): Promise<PublicUser> {
    const current = await this.users.findById(command.userId);

    if (current === null) {
      throw new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese usuario no existe.',
      });
    }

    const { input } = command;

    if (input.roleIds !== undefined) {
      await assertRolesExist(this.roles, input.roleIds);
    }

    if (command.userId === command.requesterId) {
      await this.assertKeepsOwnAccess(current, input);
    }

    return toPublicUser(await this.users.update(command.userId, await this.toChanges(input)));
  }

  /**
   * RN-5, puerta A. Se evalúa antes de tocar nada: si el cambio dejaría al
   * solicitante sin acceso o sin `roles.manage`, no se aplica nada.
   *
   * La cuenta se hace sobre los permisos efectivos que le quedarían, resueltos
   * contra la base a partir de los roles resultantes; jamás sobre nombres de
   * rol (RN-1).
   */
  private async assertKeepsOwnAccess(current: User, input: UpdateUserInput): Promise<void> {
    const touchesOwnAccess = input.isActive !== undefined || input.roleIds !== undefined;

    if (!touchesOwnAccess) {
      return;
    }

    const resultingRoleIds = input.roleIds ?? current.roles.map((role) => role.id);
    const resultingAccess = {
      isActive: input.isActive ?? current.isActive,
      permissions: await this.roles.findPermissionKeys(resultingRoleIds),
    };

    if (locksOutSelf(resultingAccess, PERMISSIONS.roles.actions.manage.key)) {
      throw new ConflictException({
        code: API_ERROR_CODES.SELF_LOCKOUT,
        message: 'No podés dejarte sin acceso ni sin el permiso para administrar roles.',
      });
    }
  }

  private async toChanges(input: UpdateUserInput): Promise<UserChanges> {
    const changes: UserChanges = {};

    if (input.fullName !== undefined) {
      changes.fullName = input.fullName;
    }

    if (input.isActive !== undefined) {
      changes.isActive = input.isActive;
    }

    if (input.roleIds !== undefined) {
      changes.roleIds = [...input.roleIds];
    }

    if (input.password !== undefined) {
      changes.passwordHash = await this.hasher.hash(input.password);
      // Mover la marca es lo que invalida las sesiones abiertas del usuario:
      // todo JWT emitido antes de este instante se rechaza (RN-10).
      changes.passwordChangedAt = new Date();
    }

    return changes;
  }
}
