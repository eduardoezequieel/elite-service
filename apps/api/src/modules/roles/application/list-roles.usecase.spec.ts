import { InMemoryRoleRepository, buildRole } from './testing/in-memory-role.repository';
import { ListRolesUseCase } from './list-roles.usecase';

describe('ListRolesUseCase', () => {
  it('returns the page of roles with their permissions and user count', async () => {
    const roles = new InMemoryRoleRepository([
      buildRole({
        id: 'role-1',
        name: 'Administrator',
        description: 'Todo',
        permissionKeys: ['roles.manage'],
        userCount: 1,
        isSystem: true,
      }),
      buildRole({ id: 'role-2', name: 'Recepción' }),
    ]);

    const listed = await new ListRolesUseCase(roles).execute({ page: 1, pageSize: 25 });

    expect(listed.total).toBe(2);
    expect(listed.items).toEqual([
      {
        id: 'role-1',
        name: 'Administrator',
        description: 'Todo',
        permissionKeys: ['roles.manage'],
        userCount: 1,
        isSystem: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'role-2',
        name: 'Recepción',
        description: null,
        permissionKeys: [],
        userCount: 0,
        isSystem: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('returns an empty page when there are no roles', async () => {
    await expect(
      new ListRolesUseCase(new InMemoryRoleRepository()).execute({ page: 1, pageSize: 25 }),
    ).resolves.toEqual({ items: [], page: 1, pageSize: 25, total: 0 });
  });

  it('cuts the requested page and keeps the total of every role', async () => {
    const roles = new InMemoryRoleRepository([
      buildRole({ id: 'role-a', name: 'A' }),
      buildRole({ id: 'role-b', name: 'B' }),
      buildRole({ id: 'role-c', name: 'C' }),
    ]);

    const page = await new ListRolesUseCase(roles).execute({ page: 2, pageSize: 2 });

    expect(page.items.map((role) => role.id)).toEqual(['role-c']);
    expect(page).toMatchObject({ page: 2, pageSize: 2, total: 3 });
  });

  it('busca por nombre sin distinguir mayúsculas', async () => {
    const roles = new InMemoryRoleRepository([
      buildRole({ id: 'role-a', name: 'Caja' }),
      buildRole({ id: 'role-b', name: 'Bahía' }),
    ]);

    const page = await new ListRolesUseCase(roles).execute({
      search: 'CAJ',
      page: 1,
      pageSize: 25,
    });

    expect(page.items.map((role) => role.id)).toEqual(['role-a']);
    expect(page.total).toBe(1);
  });
});
