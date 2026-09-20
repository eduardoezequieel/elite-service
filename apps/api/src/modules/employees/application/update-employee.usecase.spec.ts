import { API_ERROR_CODES } from '@elite/shared';

import { captureApiError } from '../../users/application/testing/capture-api-error';
import type { Employee } from '../domain/employee';
import { CreateEmployeeUseCase } from './create-employee.usecase';
import { ListEmployeesUseCase } from './list-employees.usecase';
import { FakePinDigest } from './testing/fake-pin.digest';
import { InMemoryEmployeeRepository } from './testing/in-memory-employee.repository';
import { UpdateEmployeeUseCase } from './update-employee.usecase';

const carlos: Employee = {
  id: 'employee-carlos',
  username: 'carlos',
  fullName: 'Carlos Melgar',
  pinHash: 'digest:123456',
  isActive: true,
  pinChangedAt: new Date('2026-01-01T08:00:00Z'),
  createdAt: new Date('2026-01-01T08:00:00Z'),
  updatedAt: new Date('2026-01-01T08:00:00Z'),
};

function build(seed: Employee[] = [carlos]) {
  const employees = new InMemoryEmployeeRepository(seed);
  const pins = new FakePinDigest();

  return {
    employees,
    create: new CreateEmployeeUseCase(employees, pins),
    update: new UpdateEmployeeUseCase(employees, pins),
    list: new ListEmployeesUseCase(employees),
  };
}

describe('CreateEmployeeUseCase', () => {
  it('crea el empleado con el PIN convertido y activo', async () => {
    const { create, employees } = build([]);

    const created = await create.execute({
      fullName: 'Ana Mejía',
      username: 'ana',
      pin: '432100',
    });

    expect(created.username).toBe('ana');
    expect(created.isActive).toBe(true);
    expect((await employees.findById(created.id))?.pinHash).toBe('digest:432100');
  });

  it('nunca devuelve el PIN ni su digest (RN-18, 044 RN-8)', async () => {
    const { create } = build([]);

    const created = await create.execute({ fullName: 'Ana', username: 'ana', pin: '432100' });

    expect(Object.keys(created)).not.toContain('pinHash');
    expect(JSON.stringify(created)).not.toContain('432100');
  });

  it('rechaza un usuario repetido', async () => {
    const { create } = build();

    const failure = await captureApiError(
      create.execute({ fullName: 'Otro Carlos', username: 'carlos', pin: '555555' }),
    );

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.USERNAME_TAKEN);
  });

  /**
   * El PIN es la única credencial de la pista: dos empleados con el mismo PIN
   * harían ambiguo quién entró, y quien lo repita entraría como el otro
   * (044 RN-3).
   */
  it('rechaza un PIN que ya es de otro empleado', async () => {
    const { create } = build();

    const failure = await captureApiError(
      create.execute({ fullName: 'Ana Mejía', username: 'ana', pin: '123456' }),
    );

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.PIN_TAKEN);
  });

  it('rechaza el PIN de un empleado desactivado: sigue reservado', async () => {
    const { create } = build([{ ...carlos, isActive: false }]);

    const failure = await captureApiError(
      create.execute({ fullName: 'Ana Mejía', username: 'ana', pin: '123456' }),
    );

    expect(failure.body.code).toBe(API_ERROR_CODES.PIN_TAKEN);
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

    await update.execute('employee-carlos', { pin: '987600' });

    const stored = await employees.findById('employee-carlos');

    expect(stored?.pinHash).toBe('digest:987600');
    expect(stored?.pinChangedAt.getTime()).toBeGreaterThan(carlos.pinChangedAt.getTime());
  });

  it('no toca `pinChangedAt` cuando el cambio no incluye el PIN', async () => {
    const { update, employees } = build();

    await update.execute('employee-carlos', { fullName: 'Carlos M.' });

    expect((await employees.findById('employee-carlos'))?.pinChangedAt).toEqual(
      carlos.pinChangedAt,
    );
  });

  it('rechaza tomar el PIN de otro (044 RN-3)', async () => {
    const { update } = build([
      carlos,
      { ...carlos, id: 'employee-ana', username: 'ana', pinHash: 'digest:777777' },
    ]);

    const failure = await captureApiError(update.execute('employee-ana', { pin: '123456' }));

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.PIN_TAKEN);
  });

  it('deja reponer el mismo PIN que ya tenía, sin chocar contra sí mismo', async () => {
    const { update, employees } = build();

    await update.execute('employee-carlos', { pin: '123456' });

    expect((await employees.findById('employee-carlos'))?.pinHash).toBe('digest:123456');
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
