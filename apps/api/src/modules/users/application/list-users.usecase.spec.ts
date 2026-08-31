import { ListUsersUseCase } from './list-users.usecase';
import { InMemoryUserRepository } from './testing/in-memory-user.repository';

describe('ListUsersUseCase', () => {
  it('returns the whole collection, active and inactive, without passwordHash', async () => {
    const users = new InMemoryUserRepository([
      {
        id: 'user-admin',
        email: 'admin@taller.sv',
        fullName: 'Admin del Taller',
        isActive: true,
        roles: [{ id: 'role-admin', name: 'Administrator' }],
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      },
      {
        id: 'user-baja',
        email: 'baja@taller.sv',
        fullName: 'Alguien de Baja',
        isActive: false,
        roles: [],
        createdAt: new Date('2026-01-03T00:00:00.000Z'),
        updatedAt: new Date('2026-01-04T00:00:00.000Z'),
      },
    ]);

    const listed = await new ListUsersUseCase(users).execute();

    expect(listed).toEqual([
      {
        id: 'user-admin',
        email: 'admin@taller.sv',
        fullName: 'Admin del Taller',
        isActive: true,
        roles: [{ id: 'role-admin', name: 'Administrator' }],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
      {
        id: 'user-baja',
        email: 'baja@taller.sv',
        fullName: 'Alguien de Baja',
        isActive: false,
        roles: [],
        createdAt: '2026-01-03T00:00:00.000Z',
        updatedAt: '2026-01-04T00:00:00.000Z',
      },
    ]);
    expect(listed.every((user) => !('passwordHash' in user))).toBe(true);
  });

  it('returns an empty list when there are no users', async () => {
    expect(await new ListUsersUseCase(new InMemoryUserRepository()).execute()).toEqual([]);
  });
});
