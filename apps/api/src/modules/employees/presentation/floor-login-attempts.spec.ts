import { API_ERROR_CODES } from '@elite/shared';
import { HttpException } from '@nestjs/common';

import {
  FLOOR_LOGIN_LOCK_MS,
  FLOOR_LOGIN_MAX_FAILURES,
  FloorLoginAttempts,
} from './floor-login-attempts';

/** Lo que devuelve el freno cuando cierra la puerta, sin reventar el test. */
function refusal(attempts: FloorLoginAttempts, client: string): HttpException | null {
  try {
    attempts.assertAllowed(client);
    return null;
  } catch (error) {
    return error instanceof HttpException ? error : null;
  }
}

function fail(attempts: FloorLoginAttempts, client: string, times: number): void {
  for (let i = 0; i < times; i += 1) attempts.recordFailure(client);
}

describe('FloorLoginAttempts (044 RN-6)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-20T09:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('deja pasar mientras no se agoten los intentos', () => {
    const attempts = new FloorLoginAttempts();

    fail(attempts, '10.0.0.1', FLOOR_LOGIN_MAX_FAILURES - 1);

    expect(refusal(attempts, '10.0.0.1')).toBeNull();
  });

  it('cierra la puerta al fallo número 5 con 429', () => {
    const attempts = new FloorLoginAttempts();

    fail(attempts, '10.0.0.1', FLOOR_LOGIN_MAX_FAILURES);

    const failure = refusal(attempts, '10.0.0.1');

    expect(failure?.getStatus()).toBe(429);
    expect(failure?.getResponse()).toMatchObject({ code: API_ERROR_CODES.TOO_MANY_ATTEMPTS });
  });

  /** El que se equivocó tecleando es el mismo que después entró bien. */
  it('un PIN correcto borra la racha', () => {
    const attempts = new FloorLoginAttempts();

    fail(attempts, '10.0.0.1', FLOOR_LOGIN_MAX_FAILURES - 1);
    attempts.clear('10.0.0.1');
    fail(attempts, '10.0.0.1', FLOOR_LOGIN_MAX_FAILURES - 1);

    expect(refusal(attempts, '10.0.0.1')).toBeNull();
  });

  it('vuelve a abrir cuando pasa el minuto', () => {
    const attempts = new FloorLoginAttempts();

    fail(attempts, '10.0.0.1', FLOOR_LOGIN_MAX_FAILURES);
    jest.advanceTimersByTime(FLOOR_LOGIN_LOCK_MS);

    expect(refusal(attempts, '10.0.0.1')).toBeNull();
  });

  /**
   * La racha se mide desde el último fallo: cuatro errores de la mañana no
   * pueden sumarse al de la tarde y dejar a nadie afuera con un solo tecleo mal.
   */
  it('olvida los fallos viejos antes de contar el nuevo', () => {
    const attempts = new FloorLoginAttempts();

    fail(attempts, '10.0.0.1', FLOOR_LOGIN_MAX_FAILURES - 1);
    jest.advanceTimersByTime(FLOOR_LOGIN_LOCK_MS);
    fail(attempts, '10.0.0.1', 1);

    expect(refusal(attempts, '10.0.0.1')).toBeNull();
  });

  /** La tablet de la bahía no puede quedarse afuera por la del mostrador. */
  it('cuenta a cada cliente por separado', () => {
    const attempts = new FloorLoginAttempts();

    fail(attempts, '10.0.0.1', FLOOR_LOGIN_MAX_FAILURES);

    expect(refusal(attempts, '10.0.0.2')).toBeNull();
  });
});
