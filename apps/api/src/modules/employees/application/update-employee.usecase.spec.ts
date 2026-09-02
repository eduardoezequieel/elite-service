import { API_ERROR_CODES } from '@elite/shared';

import { captureApiError } from '../../users/application/testing/capture-api-error';
import type { Employee } from '../domain/employee';
import { CreateEmployeeUseCase } from './create-employee.usecase';
import { ListEmployeesUseCase } from './list-employees.usecase';
import { FakePinHasher } from './testing/fake-pin.hasher';
import { InMemoryEmployeeRepository } from './testing/in-memory-employee.repository';
import { UpdateEmployeeUseCase } from './update-employee.usecase';

const carlos: Employee = {
  id: 'employee-carlos',
  username: 'carlos',
  fullName: 'Carlos Melgar',
  pinHash: 'hashed:1234',
  isActive: true,
  pinChangedAt: new Date('2026-01-01T08:00:00Z'),
  createdAt: new Date('2026-01-01T08:00:00Z'),
  updatedAt: new Date('2026-01-01T08:00:00Z'),
};

function build(seed: Employee[] = [carlos]) {
  const employees = new InMemoryEmployeeRepository(seed);
  const pins = new FakePinHasher();

  return {
    employees,
    create: new CreateEmployeeUseCase(employees, pins),
    update: new UpdateEmployeeUseCase(employees, pins),
    list: new ListEmployeesUseCase(employees),
  };
}

describe('CreateEmployeeUseCase', () => {
  it('crea el empleado con el PIN hasheado y activo', async () => {
    const { create, employees } = build([]);

    const created = await create.execute({
      fullName: 'Ana Mejía',
      username: 'ana',
      pin: '4321',
    });

    expect(created.username).toBe('ana');
    expect(created.isActive).toBe(true);
    expect((await employees.findById(created.id))?.pinHash).toBe('hashed:4321');
  });

  it('nunca devuelve el hash del PIN (RN-18)', async () => {
    const { create } = build([]);

    const created = await create.execute({ fullName: 'Ana', username: 'ana', pin: '4321' });

    expect(Object.keys(created)).not.toContain('pinHash');
    expect(JSON.stringify(created)).not.toContain('4321');
  });

  it('rechaza un usuario repetido', async () => {
    const { create } = build();

    const failure = await captureApiError(
      create.execute({ fullName: 'Otro Carlos', username: 'carlos', pin: '5555' }),
    );

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.USERNAME_TAKEN);
  });
});

describe('UpdateEmployeeUseCase', () => {
  it('404 si el empleado no existe', async () => {
    const { update } = build();

    const failure = await captureApiError(update.execute('nadie', { fullName: 'X' }));

    expect(failure.status).toBe(404);
  });

  it('deja editar sin chocar contra su propio usuario', async () => {
    const { update } = build();

    const updated = await update.execute('employee-carlos', {
      username: 'carlos',
      fullName: 'Carlos A. Melgar',
    });

    expect(updated.fullName).toBe('Carlos A. Melgar');
  });

  it('rechaza tomar el usuario de otro', async () => {
    const { update } = build([carlos, { ...carlos, id: 'employee-ana', username: 'ana' }]);

    const failure = await captureApiError(update.execute('employee-ana', { username: 'carlos' }));

    expect(failure.body.code).toBe(API_ERROR_CODES.USERNAME_TAKEN);
  });

  /**
   * Lo que hace que reemplazar el PIN cierre las sesiones abiertas: el hash y
   * la marca se mueven juntos. Mover uno sin el otro deja vivas justo las
   * sesiones que había que cerrar (RN-18).
   */
  it('corre `pinChangedAt` al reemplazar el PIN', async () => {
    const { update, employees } = build();

    await update.execute('employee-carlos', { pin: '9876' });

    const stored = await employees.findById('employee-carlos');

    expect(stored?.pinHash).toBe('hashed:9876');
    expect(stored?.pinChangedAt.getTime()).toBeGreaterThan(carlos.pinChangedAt.getTime());
  });

  it('no toca `pinChangedAt` cuando el cambio no incluye el PIN', async () => {
    const { update, employees } = build();

    await update.execute('employee-carlos', { fullName: 'Carlos M.' });

    expect((await employees.findById('employee-carlos'))?.pinChangedAt).toEqual(
      carlos.pinChangedAt,
    );
  });

  it('desactiva sin eliminar (RN-13)', async () => {
    const { update, employees } = build();

    const updated = await update.execute('employee-carlos', { isActive: false });

    expect(updated.isActive).toBe(false);
    expect(await employees.findById('employee-carlos')).not.toBeNull();
  });
});

describe('ListEmployeesUseCase', () => {
  it('lista sin exponer el hash del PIN', async () => {
    const { list } = build();

    const [first] = await list.execute();

    expect(first).toBeDefined();
    expect(Object.keys(first)).toEqual([
      'id',
      'username',
      'fullName',
      'isActive',
      'createdAt',
      'updatedAt',
    ]);
  });
});
