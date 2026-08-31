import { API_ERROR_CODES, type UpdateRoleInput } from '@elite/shared';

import type { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { InMemoryRoleRepository, buildRole } from '../infrastructure/in-memory-role.repository';
import { UpdateRoleUseCase } from './update-role.usecase';

/** Un solicitante con los roles indicados. Sus permisos son la union (RN-3). */
function requesterWithRoles(
  ...roles: { id: string; permissionKeys: string[] }[]
): AuthenticatedUser {
  return {
    id: 'requester-1',
    email: 'admin@taller.test',
    fullName: 'Quien pide',
    roles: roles.map((role) => ({ id: role.id, name: `rol-${role.id}` })),
    permissions: [...new Set(roles.flatMap((role) => role.permissionKeys))],
  };
}

/**
 * Una clave que no existe en el catálogo. Los tipos la rechazan en
 * compilación, pero por HTTP puede llegar cualquier cosa (RN-2).
 */
const unknownPermissionKey = 'clients.manage' as unknown as NonNullable<
  UpdateRoleInput['permissionKeys']
>[number];

const outsider = requesterWithRoles({ id: 'role-other', permissionKeys: ['roles.manage'] });

describe('UpdateRoleUseCase', () => {
  it('replaces the whole permission set without touching the role or its users (RN-6b)', async () => {
    const roles = new InMemoryRoleRepository([
      buildRole({
        id: 'role-1',
        name: 'Recepción',
        permissionKeys: ['users.read', 'roles.read'],
        userCount: 4,
      }),
    ]);
    const useCase = new UpdateRoleUseCase(roles);

    const updated = await useCase.execute('role-1', { permissionKeys: ['users.manage'] }, outsider);

    expect(updated).toMatchObject({
      id: 'role-1',
      name: 'Recepción',
      permissionKeys: ['users.manage'],
      userCount: 4,
    });
  });

  it('empties the permission set when an empty array arrives', async () => {
    const roles = new InMemoryRoleRepository([
      buildRole({ id: 'role-1', name: 'Recepción', permissionKeys: ['users.read'] }),
    ]);

    const updated = await new UpdateRoleUseCase(roles).execute(
      'role-1',
      { permissionKeys: [] },
      outsider,
    );

    expect(updated.permissionKeys).toEqual([]);
  });

  it('renames a role and leaves the rest untouched', async () => {
    const roles = new InMemoryRoleRepository([
      buildRole({ id: 'role-1', name: 'Recepción', permissionKeys: ['users.read'] }),
    ]);

    const updated = await new UpdateRoleUseCase(roles).execute(
      'role-1',
      { name: 'Mostrador' },
      outsider,
    );

    expect(updated).toMatchObject({ name: 'Mostrador', permissionKeys: ['users.read'] });
  });

  it('accepts keeping its own name', async () => {
    const roles = new InMemoryRoleRepository([buildRole({ id: 'role-1', name: 'Recepción' })]);

    const updated = await new UpdateRoleUseCase(roles).execute(
      'role-1',
      { name: 'Recepción', description: 'El mostrador' },
      outsider,
    );

    expect(updated.description).toBe('El mostrador');
  });

  it('rejects a name that another role already has: 409 NAME_TAKEN', async () => {
    const roles = new InMemoryRoleRepository([
      buildRole({ id: 'role-1', name: 'Recepción' }),
      buildRole({ id: 'role-2', name: 'Taller' }),
    ]);

    await expect(
      new UpdateRoleUseCase(roles).execute('role-2', { name: 'recepción' }, outsider),
    ).rejects.toMatchObject({ status: 409, response: { code: API_ERROR_CODES.NAME_TAKEN } });
  });

  it('answers 404 NOT_FOUND for a role that does not exist', async () => {
    await expect(
      new UpdateRoleUseCase(new InMemoryRoleRepository()).execute(
        'missing',
        { name: 'X' },
        outsider,
      ),
    ).rejects.toMatchObject({ status: 404, response: { code: API_ERROR_CODES.NOT_FOUND } });
  });

  it('rejects permission keys outside the shared catalog with 422 (RN-2)', async () => {
    const roles = new InMemoryRoleRepository([buildRole({ id: 'role-1', name: 'Recepción' })]);

    await expect(
      new UpdateRoleUseCase(roles).execute(
        'role-1',
        { permissionKeys: [unknownPermissionKey] },
        outsider,
      ),
    ).rejects.toMatchObject({
      status: 422,
      response: { code: API_ERROR_CODES.VALIDATION_ERROR },
    });
  });

  describe('RN-5, gate B: anti-lockout', () => {
    it('refuses to strip roles.manage from a role the requester has: 409 SELF_LOCKOUT', async () => {
      const roles = new InMemoryRoleRepository([
        buildRole({
          id: 'role-1',
          name: 'Administrator',
          permissionKeys: ['roles.manage', 'users.manage'],
          userCount: 1,
        }),
      ]);
      const requester = requesterWithRoles({
        id: 'role-1',
        permissionKeys: ['roles.manage', 'users.manage'],
      });

      await expect(
        new UpdateRoleUseCase(roles).execute(
          'role-1',
          { permissionKeys: ['users.manage'] },
          requester,
        ),
      ).rejects.toMatchObject({ status: 409, response: { code: API_ERROR_CODES.SELF_LOCKOUT } });

      const untouched = await roles.findById('role-1');

      expect(untouched?.permissionKeys).toEqual(['roles.manage', 'users.manage']);
    });

    it('allows it when another role of the requester still grants roles.manage', async () => {
      const roles = new InMemoryRoleRepository([
        buildRole({ id: 'role-1', name: 'Recepción', permissionKeys: ['roles.manage'] }),
        buildRole({ id: 'role-2', name: 'Dirección', permissionKeys: ['roles.manage'] }),
      ]);
      const requester = requesterWithRoles(
        { id: 'role-1', permissionKeys: ['roles.manage'] },
        { id: 'role-2', permissionKeys: ['roles.manage'] },
      );

      const updated = await new UpdateRoleUseCase(roles).execute(
        'role-1',
        { permissionKeys: ['users.read'] },
        requester,
      );

      expect(updated.permissionKeys).toEqual(['users.read']);
    });

    it('does not block editing a role the requester does not have', async () => {
      const roles = new InMemoryRoleRepository([
        buildRole({ id: 'role-1', name: 'Recepción', permissionKeys: ['roles.manage'] }),
      ]);

      const updated = await new UpdateRoleUseCase(roles).execute(
        'role-1',
        { permissionKeys: [] },
        outsider,
      );

      expect(updated.permissionKeys).toEqual([]);
    });

    it('does not block a change that keeps roles.manage in the role', async () => {
      const roles = new InMemoryRoleRepository([
        buildRole({ id: 'role-1', name: 'Administrator', permissionKeys: ['roles.manage'] }),
      ]);
      const requester = requesterWithRoles({ id: 'role-1', permissionKeys: ['roles.manage'] });

      const updated = await new UpdateRoleUseCase(roles).execute(
        'role-1',
        { permissionKeys: ['roles.manage', 'users.read'] },
        requester,
      );

      expect(updated.permissionKeys).toEqual(['roles.manage', 'users.read']);
    });

    it('does not evaluate the gate when the change does not touch the permissions', async () => {
      const roles = new InMemoryRoleRepository([
        buildRole({ id: 'role-1', name: 'Administrator', permissionKeys: ['roles.manage'] }),
      ]);
      const requester = requesterWithRoles({ id: 'role-1', permissionKeys: ['roles.manage'] });

      const updated = await new UpdateRoleUseCase(roles).execute(
        'role-1',
        { description: 'Sin permisos nuevos' },
        requester,
      );

      expect(updated).toMatchObject({
        description: 'Sin permisos nuevos',
        permissionKeys: ['roles.manage'],
      });
    });
  });
});
