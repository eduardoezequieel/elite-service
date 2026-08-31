import { API_ERROR_CODES, PERMISSIONS } from '@elite/shared';

import { CreateUserUseCase } from './create-user.usecase';
import { captureApiError } from './testing/capture-api-error';
import { FakePasswordHasher } from './testing/fake-password.hasher';
import { InMemoryRoleDirectory } from './testing/in-memory-role.directory';
import { InMemoryUserRepository } from './testing/in-memory-user.repository';

const ADMIN_ROLE_ID = 'role-admin';

function buildUseCase(users: InMemoryUserRepository): CreateUserUseCase {
  const roles = new InMemoryRoleDirectory(
    new Map([[ADMIN_ROLE_ID, [PERMISSIONS.roles.actions.manage.key]]]),
  );

  return new CreateUserUseCase(users, roles, new FakePasswordHasher());
}

describe('CreateUserUseCase', () => {
  it('creates the user, hashes the password and never returns it', async () => {
    const users = new InMemoryUserRepository();

    const created = await buildUseCase(users).execute({
      email: 'ana@taller.sv',
      fullName: 'Ana Ramírez',
      password: 'contrasena-larga',
      roleIds: [ADMIN_ROLE_ID],
    });

    expect(created).toEqual({
      id: 'user-1',
      email: 'ana@taller.sv',
      fullName: 'Ana Ramírez',
      isActive: true,
      roles: [{ id: ADMIN_ROLE_ID, name: `Role ${ADMIN_ROLE_ID}` }],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(JSON.stringify(created)).not.toContain('contrasena-larga');
    expect(users.passwordHashOf('user-1')).toBe('hashed:contrasena-larga');
  });

  it('accepts a user without roles', async () => {
    const users = new InMemoryUserRepository();

    const created = await buildUseCase(users).execute({
      email: 'sin-roles@taller.sv',
      fullName: 'Sin Roles',
      password: 'contrasena-larga',
      roleIds: [],
    });

    expect(created.roles).toEqual([]);
  });

  it('rejects a repeated email with 409 EMAIL_TAKEN', async () => {
    const users = new InMemoryUserRepository();
    const useCase = buildUseCase(users);
    const input = {
      email: 'ana@taller.sv',
      fullName: 'Ana Ramírez',
      password: 'contrasena-larga',
      roleIds: [],
    };

    await useCase.execute(input);
    const failure = await captureApiError(useCase.execute({ ...input, fullName: 'Otra Ana' }));

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.EMAIL_TAKEN);
    expect(await users.findAll()).toHaveLength(1);
  });

  it('rejects an unknown roleId with 422 INVALID_ROLE and lists it in details', async () => {
    const users = new InMemoryUserRepository();

    const failure = await captureApiError(
      buildUseCase(users).execute({
        email: 'ana@taller.sv',
        fullName: 'Ana Ramírez',
        password: 'contrasena-larga',
        roleIds: [ADMIN_ROLE_ID, 'role-fantasma'],
      }),
    );

    expect(failure.status).toBe(422);
    expect(failure.body.code).toBe(API_ERROR_CODES.INVALID_ROLE);
    expect(failure.body.details).toEqual({ roleIds: ['role-fantasma'] });
    expect(await users.findAll()).toHaveLength(0);
  });
});
