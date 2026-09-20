import { API_ERROR_CODES } from '@elite/shared';

import { captureApiError } from '../../users/application/testing/capture-api-error';
import type { Employee } from '../domain/employee';
import { FloorLoginUseCase } from './floor-login.usecase';
import { FakeFloorTokenIssuer } from './testing/fake-floor-token.issuer';
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

const despedido: Employee = {
  ...carlos,
  id: 'employee-jose',
  username: 'jose',
  pinHash: 'digest:222222',
  isActive: false,
};

function build(seed: Employee[] = [carlos, despedido]) {
  const employees = new InMemoryEmployeeRepository(seed);
  const tokens = new FakeFloorTokenIssuer();
  const useCase = new FloorLoginUseCase(employees, new FakePinDigest(), tokens);

  return { employees, tokens, useCase };
}

describe('FloorLoginUseCase (044)', () => {
  it('entrega sesión de pista con solo el PIN (RN-1)', async () => {
    const { useCase, tokens } = build();

    const result = await useCase.execute({ pin: '123456' });

    expect(result.session.employee).toEqual({
      id: 'employee-carlos',
      username: 'carlos',
      fullName: 'Carlos Melgar',
    });
    expect(tokens.issued).toEqual(['employee-carlos']);
  });

  it('no devuelve el PIN ni su digest por ningún camino (RN-8)', async () => {
    const { useCase } = build();

    const result = await useCase.execute({ pin: '123456' });

    expect(JSON.stringify(result.session)).not.toContain('digest');
    expect(JSON.stringify(result.session)).not.toContain('123456');
  });

  /**
   * Los dos motivos responden igual. Si el mensaje o el código cambiaran según
   * el caso, probar PINes se volvería un método para averiguar quién trabaja en
   * el taller y quién dejó de trabajar (RN-7).
   */
  it.each([
    ['PIN de nadie', '999999'],
    ['PIN de un empleado desactivado', '222222'],
  ])('rechaza %s sin revelar cuál falló', async (_caso, pin) => {
    const { useCase } = build();

    const failure = await captureApiError(useCase.execute({ pin }));

    expect(failure.status).toBe(401);
    expect(failure.body.code).toBe(API_ERROR_CODES.INVALID_CREDENTIALS);
    expect(failure.body.message).toBe('PIN incorrecto.');
  });

  it('no emite token cuando el login falla', async () => {
    const { useCase, tokens } = build();

    await captureApiError(useCase.execute({ pin: '999999' }));

    expect(tokens.issued).toEqual([]);
  });

  /**
   * El digest es determinista justo para esto: una consulta por índice y no una
   * comparación contra cada empleado del taller (RN-4).
   */
  it('busca al empleado con una sola consulta, exista o no el PIN', async () => {
    const employees = new InMemoryEmployeeRepository([carlos]);
    const lookup = jest.spyOn(employees, 'findByPinHash');
    const useCase = new FloorLoginUseCase(
      employees,
      new FakePinDigest(),
      new FakeFloorTokenIssuer(),
    );

    await captureApiError(useCase.execute({ pin: '999999' }));
    await useCase.execute({ pin: '123456' });

    expect(lookup).toHaveBeenCalledTimes(2);
  });
});
