import { API_ERROR_CODES } from '@elite/shared';

import { captureApiError } from '../../users/application/testing/capture-api-error';
import type { Employee } from '../domain/employee';
import { FloorLoginUseCase } from './floor-login.usecase';
import { FakeFloorTokenIssuer } from './testing/fake-floor-token.issuer';
import { FakePinHasher } from './testing/fake-pin.hasher';
import { InMemoryEmployeeRepository } from './testing/in-memory-employee.repository';

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

const despedido: Employee = { ...carlos, id: 'employee-jose', username: 'jose', isActive: false };

function build(seed: Employee[] = [carlos, despedido]) {
  const employees = new InMemoryEmployeeRepository(seed);
  const tokens = new FakeFloorTokenIssuer();
  const useCase = new FloorLoginUseCase(employees, new FakePinHasher(), tokens);

  return { employees, tokens, useCase };
}

describe('FloorLoginUseCase (RN-18)', () => {
  it('entrega sesión de pista con usuario y PIN correctos', async () => {
    const { useCase, tokens } = build();

    const result = await useCase.execute({ username: 'carlos', pin: '1234' });

    expect(result.session.employee).toEqual({
      id: 'employee-carlos',
      username: 'carlos',
      fullName: 'Carlos Melgar',
    });
    expect(tokens.issued).toEqual(['employee-carlos']);
  });

  it('no devuelve el hash del PIN por ningún camino (RN-18)', async () => {
    const { useCase } = build();

    const result = await useCase.execute({ username: 'carlos', pin: '1234' });

    expect(JSON.stringify(result.session)).not.toContain('hashed');
    expect(JSON.stringify(result.session)).not.toContain('1234');
  });

  /**
   * Los tres motivos responden igual. Si el mensaje o el código cambiaran según
   * el caso, probar usuarios se volvería un método para averiguar quién trabaja
   * en el taller.
   */
  it.each([
    ['PIN equivocado', { username: 'carlos', pin: '9999' }],
    ['usuario que no existe', { username: 'nadie', pin: '1234' }],
    ['empleado desactivado', { username: 'jose', pin: '1234' }],
  ])('rechaza %s sin revelar cuál falló', async (_caso, input) => {
    const { useCase } = build();

    const failure = await captureApiError(useCase.execute(input));

    expect(failure.status).toBe(401);
    expect(failure.body.code).toBe(API_ERROR_CODES.INVALID_CREDENTIALS);
    expect(failure.body.message).toBe('Usuario o PIN incorrectos.');
  });

  it('no emite token cuando el login falla', async () => {
    const { useCase, tokens } = build();

    await captureApiError(useCase.execute({ username: 'carlos', pin: '9999' }));

    expect(tokens.issued).toEqual([]);
  });

  /**
   * Sin esto, un usuario inexistente responde en microsegundos y uno real tarda
   * lo que tarda bcrypt: el reloj delata quién existe. Se verifica siempre,
   * contra un hash de descarte cuando no hay a quién comparar.
   */
  it('verifica el PIN aunque el usuario no exista, para no delatarlo con el reloj', async () => {
    const hasher = new FakePinHasher();
    const verify = jest.spyOn(hasher, 'verify');
    const useCase = new FloorLoginUseCase(
      new InMemoryEmployeeRepository([carlos]),
      hasher,
      new FakeFloorTokenIssuer(),
    );

    await captureApiError(useCase.execute({ username: 'nadie', pin: '1234' }));

    expect(verify).toHaveBeenCalledTimes(1);
  });
});
