import type { Employee } from '../domain/employee';
import { ListEmployeesUseCase } from './list-employees.usecase';
import { InMemoryEmployeeRepository } from './testing/in-memory-employee.repository';

const carlos: Employee = {
  id: 'employee-carlos',
  username: 'carlos',
  fullName: 'Carlos Melgar',
  pinHash: 'digest:123456',
  isActive: true,
  pinChangedAt: new Date('2026-01-01T08:00:00Z'),
  createdAt: new Date('2026-01-01T08:00:00Z'),
  updatedAt: new Date('2026-01-02T09:30:00Z'),
};

const ana: Employee = {
  ...carlos,
  id: 'employee-ana',
  username: 'ana',
  fullName: 'Ana Mejía',
  pinHash: 'digest:777777',
  isActive: false,
};

describe('ListEmployeesUseCase', () => {
  it('lista sin exponer el hash del PIN ni su marca de cambio', async () => {
    const list = new ListEmployeesUseCase(new InMemoryEmployeeRepository([carlos]));

    const {
      items: [first],
    } = await list.execute({ page: 1, pageSize: 25 });

    expect(first).toEqual({
      id: 'employee-carlos',
      username: 'carlos',
      fullName: 'Carlos Melgar',
      isActive: true,
      createdAt: '2026-01-01T08:00:00.000Z',
      updatedAt: '2026-01-02T09:30:00.000Z',
    });
  });

  it('trae también a los desactivados, en el orden del repositorio', async () => {
    const list = new ListEmployeesUseCase(new InMemoryEmployeeRepository([carlos, ana]));

    const listed = await list.execute({ page: 1, pageSize: 25 });

    expect(listed.items.map((employee) => [employee.username, employee.isActive])).toEqual([
      ['ana', false],
      ['carlos', true],
    ]);
  });

  it('sin empleados devuelve una página vacía', async () => {
    const list = new ListEmployeesUseCase(new InMemoryEmployeeRepository());

    expect(await list.execute({ page: 1, pageSize: 25 })).toEqual({
      items: [],
      page: 1,
      pageSize: 25,
      total: 0,
    });
  });

  it('recorta la página pedida y cuenta a todos', async () => {
    const list = new ListEmployeesUseCase(
      new InMemoryEmployeeRepository([
        carlos,
        ana,
        { ...carlos, id: 'employee-zoe', fullName: 'Zoe' },
      ]),
    );

    const page = await list.execute({ page: 2, pageSize: 2 });

    expect(page.items.map((employee) => employee.id)).toEqual(['employee-zoe']);
    expect(page).toMatchObject({ page: 2, pageSize: 2, total: 3 });
  });

  it('busca por nombre o usuario y recorta por estado', async () => {
    const list = new ListEmployeesUseCase(new InMemoryEmployeeRepository([carlos, ana]));
    const page = { page: 1, pageSize: 25 };

    expect((await list.execute({ ...page, search: 'MEJ' })).items.map((e) => e.id)).toEqual([
      'employee-ana',
    ]);
    expect((await list.execute({ ...page, search: 'carl' })).total).toBe(1);
    expect((await list.execute({ ...page, active: false })).items.map((e) => e.id)).toEqual([
      'employee-ana',
    ]);
  });
});
