import { API_ERROR_CODES, PERMISSIONS } from '@elite/shared';

import type { User } from '../domain/user';
import { UpdateUserUseCase } from './update-user.usecase';
import { captureApiError } from './testing/capture-api-error';
import { FakePasswordHasher } from './testing/fake-password.hasher';
import { InMemoryRoleDirectory } from './testing/in-memory-role.directory';
import { InMemoryUserRepository } from './testing/in-memory-user.repository';

const ROLES_MANAGE = PERMISSIONS.roles.actions.manage.key;
const USERS_READ = PERMISSIONS.users.actions.read.key;

/** Un rol que da `roles.manage`; otro que no. Los nombres son puro dato (RN-1). */
const ADMIN_ROLE_ID = 'role-admin';
const VIEWER_ROLE_ID = 'role-viewer';

const roleCatalog = new Map<string, readonly string[]>([
  [ADMIN_ROLE_ID, [ROLES_MANAGE, USERS_READ]],
  [VIEWER_ROLE_ID, [USERS_READ]],
]);

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-admin',
    email: 'admin@taller.sv',
    fullName: 'Admin del Taller',
    isActive: true,
    roles: [{ id: ADMIN_ROLE_ID, name: 'Administrator' }],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildUseCase(users: InMemoryUserRepository): UpdateUserUseCase {
  return new UpdateUserUseCase(
    users,
    new InMemoryRoleDirectory(roleCatalog),
    new FakePasswordHasher(),
  );
}

describe('UpdateUserUseCase', () => {
  it('updates the name and the roles of another user', async () => {
    const users = new InMemoryUserRepository([
      buildUser(),
      buildUser({ id: 'user-ana', email: 'ana@taller.sv', fullName: 'Ana', roles: [] }),
    ]);

    const updated = await buildUseCase(users).execute({
      userId: 'user-ana',
      requesterId: 'user-admin',
      input: { fullName: 'Ana Ramírez', roleIds: [VIEWER_ROLE_ID] },
    });

    expect(updated.fullName).toBe('Ana Ramírez');
    expect(updated.roles).toEqual([{ id: VIEWER_ROLE_ID, name: `Role ${VIEWER_ROLE_ID}` }]);
    expect(updated.updatedAt).toBe('2026-02-01T00:00:00.000Z');
  });

  it('deactivates another user instead of deleting it (RN-4)', async () => {
    const users = new InMemoryUserRepository([
      buildUser(),
      buildUser({ id: 'user-ana', email: 'ana@taller.sv', roles: [] }),
    ]);

    const updated = await buildUseCase(users).execute({
      userId: 'user-ana',
      requesterId: 'user-admin',
      input: { isActive: false },
    });

    expect(updated.isActive).toBe(false);
    expect(await users.findAll()).toHaveLength(2);
  });

  it('replaces the password and moves passwordChangedAt (RN-10)', async () => {
    const users = new InMemoryUserRepository([
      buildUser(),
      buildUser({ id: 'user-ana', email: 'ana@taller.sv', roles: [] }),
    ]);
    const before = Date.now();

    const updated = await buildUseCase(users).execute({
      userId: 'user-ana',
      requesterId: 'user-admin',
      input: { password: 'contrasena-nueva' },
    });

    expect(users.passwordHashOf('user-ana')).toBe('hashed:contrasena-nueva');
    expect(users.passwordChangedAtOf('user-ana')?.getTime()).toBeGreaterThanOrEqual(before);
    expect(JSON.stringify(updated)).not.toContain('contrasena-nueva');
  });

  it('answers 404 NOT_FOUND for an unknown user', async () => {
    const users = new InMemoryUserRepository([buildUser()]);

    const failure = await captureApiError(
      buildUseCase(users).execute({
        userId: 'user-fantasma',
        requesterId: 'user-admin',
        input: { fullName: 'Nadie' },
      }),
    );

    expect(failure.status).toBe(404);
    expect(failure.body.code).toBe(API_ERROR_CODES.NOT_FOUND);
  });

  it('answers 422 INVALID_ROLE when a roleId does not exist', async () => {
    const users = new InMemoryUserRepository([buildUser()]);

    const failure = await captureApiError(
      buildUseCase(users).execute({
        userId: 'user-admin',
        requesterId: 'user-admin',
        input: { roleIds: ['role-fantasma'] },
      }),
    );

    expect(failure.status).toBe(422);
    expect(failure.body.code).toBe(API_ERROR_CODES.INVALID_ROLE);
    expect(failure.body.details).toEqual({ roleIds: ['role-fantasma'] });
  });

  describe('anti-lockout (RN-5, puerta A)', () => {
    it('refuses to let the requester deactivate themselves', async () => {
      const users = new InMemoryUserRepository([buildUser()]);

      const failure = await captureApiError(
        buildUseCase(users).execute({
          userId: 'user-admin',
          requesterId: 'user-admin',
          input: { isActive: false },
        }),
      );

      expect(failure.status).toBe(409);
      expect(failure.body.code).toBe(API_ERROR_CODES.SELF_LOCKOUT);
      expect((await users.findById('user-admin'))?.isActive).toBe(true);
    });

    it('refuses a role change that would leave the requester without roles.manage', async () => {
      const users = new InMemoryUserRepository([buildUser()]);

      const failure = await captureApiError(
        buildUseCase(users).execute({
          userId: 'user-admin',
          requesterId: 'user-admin',
          // El rol existe, pero no otorga roles.manage.
          input: { roleIds: [VIEWER_ROLE_ID] },
        }),
      );

      expect(failure.status).toBe(409);
      expect(failure.body.code).toBe(API_ERROR_CODES.SELF_LOCKOUT);
      expect((await users.findById('user-admin'))?.roles).toEqual([
        { id: ADMIN_ROLE_ID, name: 'Administrator' },
      ]);
    });

    it('refuses to leave the requester with no roles at all', async () => {
      const users = new InMemoryUserRepository([buildUser()]);

      const failure = await captureApiError(
        buildUseCase(users).execute({
          userId: 'user-admin',
          requesterId: 'user-admin',
          input: { roleIds: [] },
        }),
      );

      expect(failure.status).toBe(409);
      expect(failure.body.code).toBe(API_ERROR_CODES.SELF_LOCKOUT);
    });

    it('allows a self role change that keeps roles.manage, whatever the role is called', async () => {
      const users = new InMemoryUserRepository([buildUser()]);

      const updated = await buildUseCase(users).execute({
        userId: 'user-admin',
        requesterId: 'user-admin',
        input: { roleIds: [ADMIN_ROLE_ID, VIEWER_ROLE_ID] },
      });

      expect(updated.roles).toHaveLength(2);
    });

    it('allows the requester to edit their own name without touching access', async () => {
      const users = new InMemoryUserRepository([buildUser()]);

      const updated = await buildUseCase(users).execute({
        userId: 'user-admin',
        requesterId: 'user-admin',
        input: { fullName: 'Admin Renombrado' },
      });

      expect(updated.fullName).toBe('Admin Renombrado');
    });

    it('does not apply to a different user: an admin can still deactivate someone else', async () => {
      const users = new InMemoryUserRepository([
        buildUser(),
        buildUser({ id: 'user-otro', email: 'otro@taller.sv' }),
      ]);

      const updated = await buildUseCase(users).execute({
        userId: 'user-otro',
        requesterId: 'user-admin',
        input: { isActive: false, roleIds: [] },
      });

      expect(updated.isActive).toBe(false);
      expect(updated.roles).toEqual([]);
    });
  });
});
