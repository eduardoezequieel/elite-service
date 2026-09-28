import { API_ERROR_CODES } from '@elite/shared';

import { captureApiError } from '../../users/application/testing/capture-api-error';
import type { Employee } from '../domain/employee';
import { CreateEmployeeUseCase } from './create-employee.usecase';
import { FakePinDigest } from './testing/fake-pin.digest';
import { InMemoryEmployeeRepository } from './testing/in-memory-employee.repository';

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

  return { employees, create: new CreateEmployeeUseCase(employees, new FakePinDigest()) };
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
    expect(created.fullName).toBe('Ana Mejía');
    expect(created.isActive).toBe(true);
    expect((await employees.findById(created.id))?.pinHash).toBe('digest:432100');
  });

  it('nunca devuelve el PIN ni su digest (RN-18, 044 RN-8)', async () => {
    const { create } = build([]);

    const created = await create.execute({ fullName: 'Ana', username: 'ana', pin: '432100' });

    expect(Object.keys(created)).toEqual([
      'id',
      'username',
      'fullName',
      'isActive',
      'createdAt',
      'updatedAt',
    ]);
    expect(JSON.stringify(created)).not.toContain('432100');
  });

  it('rechaza un usuario repetido y no guarda nada', async () => {
    const { create, employees } = build();

    const failure = await captureApiError(
      create.execute({ fullName: 'Otro Carlos', username: 'carlos', pin: '555555' }),
    );

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.USERNAME_TAKEN);
    expect(await employees.findAll()).toHaveLength(1);
  });

  /**
   * El PIN es la única credencial de la pista: dos empleados con el mismo PIN
   * harían ambiguo quién entró, y quien lo repita entraría como el otro
   * (044 RN-3).
   */
  it('rechaza un PIN que ya es de otro empleado y no guarda nada', async () => {
    const { create, employees } = build();

    const failure = await captureApiError(
      create.execute({ fullName: 'Ana Mejía', username: 'ana', pin: '123456' }),
    );

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.PIN_TAKEN);
    expect(await employees.findAll()).toHaveLength(1);
  });

  it('rechaza el PIN de un empleado desactivado: sigue reservado', async () => {
    const { create } = build([{ ...carlos, isActive: false }]);

    const failure = await captureApiError(
      create.execute({ fullName: 'Ana Mejía', username: 'ana', pin: '123456' }),
    );

    expect(failure.body.code).toBe(API_ERROR_CODES.PIN_TAKEN);
  });

  it('el usuario repetido gana sobre el PIN repetido', async () => {
    const { create } = build();

    const failure = await captureApiError(
      create.execute({ fullName: 'Carlos Dos', username: 'carlos', pin: '123456' }),
    );

    expect(failure.body.code).toBe(API_ERROR_CODES.USERNAME_TAKEN);
  });
});
