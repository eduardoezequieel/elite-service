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

    const [first] = await list.execute();

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

    const listed = await list.execute();

    expect(listed.map((employee) => [employee.username, employee.isActive])).toEqual([
      ['ana', false],
      ['carlos', true],
    ]);
  });

  it('sin empleados devuelve una lista vacía', async () => {
    const list = new ListEmployeesUseCase(new InMemoryEmployeeRepository());

    expect(await list.execute()).toEqual([]);
  });
});
