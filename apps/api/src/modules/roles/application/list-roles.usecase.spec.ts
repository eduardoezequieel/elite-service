import { InMemoryRoleRepository, buildRole } from '../infrastructure/in-memory-role.repository';
import { ListRolesUseCase } from './list-roles.usecase';

describe('ListRolesUseCase', () => {
  it('returns every role with its permissions and user count, without pagination', async () => {
    const roles = new InMemoryRoleRepository([
      buildRole({
        id: 'role-1',
        name: 'Administrator',
        description: 'Todo',
        permissionKeys: ['roles.manage'],
        userCount: 1,
      }),
      buildRole({ id: 'role-2', name: 'Recepción' }),
    ]);

    const listed = await new ListRolesUseCase(roles).execute();

    expect(listed).toEqual([
      {
        id: 'role-1',
        name: 'Administrator',
        description: 'Todo',
        permissionKeys: ['roles.manage'],
        userCount: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'role-2',
        name: 'Recepción',
        description: null,
        permissionKeys: [],
        userCount: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('returns an empty list when there are no roles', async () => {
    await expect(new ListRolesUseCase(new InMemoryRoleRepository()).execute()).resolves.toEqual([]);
  });
});
