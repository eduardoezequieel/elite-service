import { ListUsersUseCase } from './list-users.usecase';
import { InMemoryUserRepository } from './testing/in-memory-user.repository';

describe('ListUsersUseCase', () => {
  it('returns the page, active and inactive, without passwordHash', async () => {
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

    const page = await new ListUsersUseCase(users).execute({ page: 1, pageSize: 25 });
    const listed = page.items;

    expect(page.total).toBe(2);
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

  it('returns an empty page when there are no users', async () => {
    expect(
      await new ListUsersUseCase(new InMemoryUserRepository()).execute({ page: 1, pageSize: 25 }),
    ).toEqual({ items: [], page: 1, pageSize: 25, total: 0 });
  });

  it('cuts the requested page and keeps the total of every user', async () => {
    const base = {
      email: 'x@taller.sv',
      isActive: true,
      roles: [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const users = new InMemoryUserRepository([
      { ...base, id: 'u1', fullName: 'Uno' },
      { ...base, id: 'u2', fullName: 'Dos' },
      { ...base, id: 'u3', fullName: 'Tres' },
    ]);

    const page = await new ListUsersUseCase(users).execute({ page: 2, pageSize: 2 });

    expect(page.items.map((user) => user.id)).toEqual(['u3']);
    expect(page).toMatchObject({ page: 2, pageSize: 2, total: 3 });
  });

  it('filtra por búsqueda, estado y rol, y excludeSelf saca a quien pregunta', async () => {
    const base = {
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const users = new InMemoryUserRepository([
      { ...base, id: 'me', email: 'yo@taller.sv', fullName: 'Yo', isActive: true, roles: [] },
      {
        ...base,
        id: 'cajera',
        email: 'caja@taller.sv',
        fullName: 'Marta',
        isActive: true,
        roles: [{ id: 'role-caja', name: 'Caja' }],
      },
      {
        ...base,
        id: 'baja',
        email: 'baja@taller.sv',
        fullName: 'Pedro',
        isActive: false,
        roles: [],
      },
    ]);
    const list = new ListUsersUseCase(users);
    const page = { page: 1, pageSize: 25 };
    const ids = async (query: Parameters<ListUsersUseCase['execute']>[0]) =>
      (await list.execute(query, 'me')).items.map((user) => user.id);

    expect(await ids({ ...page, excludeSelf: true })).toEqual(['cajera', 'baja']);
    expect(await ids({ ...page, search: 'CAJA@' })).toEqual(['cajera']);
    expect(await ids({ ...page, active: false })).toEqual(['baja']);
    expect(await ids({ ...page, roleId: 'role-caja' })).toEqual(['cajera']);
    expect((await list.execute({ ...page, excludeSelf: true }, 'me')).total).toBe(2);
  });
});
