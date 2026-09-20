import { API_ERROR_CODES, PERMISSIONS } from '@elite/shared';
import { ForbiddenException } from '@nestjs/common';

import type { AuthUser } from '../domain/auth-user';
import { AuthorizeActionUseCase } from './authorize-action.usecase';
import type { AuthUserRepository } from './ports/auth-user.repository';
import type { PasswordHasher } from './ports/password-hasher';

const VOID = PERMISSIONS.carwash.actions.void.key;

class InMemoryAuthUserRepository implements AuthUserRepository {
  constructor(private readonly users: AuthUser[]) {}

  findByEmail(email: string): Promise<AuthUser | null> {
    return Promise.resolve(this.users.find((user) => user.email === email) ?? null);
  }

  findById(id: string): Promise<AuthUser | null> {
    return Promise.resolve(this.users.find((user) => user.id === id) ?? null);
  }

  updatePassword(): Promise<void> {
    return Promise.reject(new Error('Authorizing does not change passwords.'));
  }
}

/** Hasher de mentira: reversible y sin costo, para que el test no tarde. */
class FakePasswordHasher implements PasswordHasher {
  hash(plainPassword: string): Promise<string> {
    return Promise.resolve(`hashed:${plainPassword}`);
  }

  verify(plainPassword: string, passwordHash: string): Promise<boolean> {
    return Promise.resolve(passwordHash === `hashed:${plainPassword}`);
  }
}

const REFERENCE_DATE = new Date('2026-01-01T00:00:00.000Z');

function buildUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-1',
    email: 'jefe@elite.local',
    fullName: 'Ana Jefa',
    passwordHash: 'hashed:secreta123',
    isActive: true,
    passwordChangedAt: REFERENCE_DATE,
    roles: [{ id: 'role-1', name: 'Encargado', permissionKeys: [VOID] }],
    createdAt: REFERENCE_DATE,
    updatedAt: REFERENCE_DATE,
    ...overrides,
  };
}

function buildUseCase(users: AuthUser[]): AuthorizeActionUseCase {
  return new AuthorizeActionUseCase(
    new InMemoryAuthUserRepository(users),
    new FakePasswordHasher(),
  );
}

const CREDENTIALS = { email: 'jefe@elite.local', password: 'secreta123' };

async function captureError(operation: Promise<unknown>): Promise<ForbiddenException> {
  try {
    await operation;
  } catch (error: unknown) {
    return error as ForbiddenException;
  }

  throw new Error('Se esperaba un error y no hubo ninguno.');
}

/** Los cuatro finales salen por la misma puerta menos el feliz (RN-2). */
function expectRejection(error: ForbiddenException): void {
  expect(error).toBeInstanceOf(ForbiddenException);
  expect(error.getStatus()).toBe(403);
  expect(error.getResponse()).toEqual({
    code: API_ERROR_CODES.AUTHORIZATION_FAILED,
    message: 'Esas credenciales no autorizan esta acción.',
  });
}

describe('AuthorizeActionUseCase', () => {
  it('authorizes an active user that holds the permission and returns its name for the note', async () => {
    const useCase = buildUseCase([buildUser()]);

    await expect(useCase.execute(CREDENTIALS, [VOID])).resolves.toEqual({
      id: 'user-1',
      fullName: 'Ana Jefa',
    });
  });

  it('takes the permission from the union of all its roles, never from the role name', async () => {
    const useCase = buildUseCase([
      buildUser({
        roles: [
          { id: 'role-1', name: 'Recepción', permissionKeys: ['carwash.read'] },
          { id: 'role-2', name: 'Caja', permissionKeys: [VOID] },
        ],
      }),
    ]);

    await expect(useCase.execute(CREDENTIALS, [VOID])).resolves.toEqual({
      id: 'user-1',
      fullName: 'Ana Jefa',
    });
  });

  it('rejects an unknown email', async () => {
    const useCase = buildUseCase([buildUser()]);

    expectRejection(
      await captureError(useCase.execute({ ...CREDENTIALS, email: 'nadie@elite.local' }, [VOID])),
    );
  });

  it('rejects a wrong password', async () => {
    const useCase = buildUseCase([buildUser()]);

    expectRejection(
      await captureError(useCase.execute({ ...CREDENTIALS, password: 'otra' }, [VOID])),
    );
  });

  it('rejects a deactivated user even with the right password and permission', async () => {
    const useCase = buildUseCase([buildUser({ isActive: false })]);

    expectRejection(await captureError(useCase.execute(CREDENTIALS, [VOID])));
  });

  it('rejects an active user without the permission the action asks for', async () => {
    const useCase = buildUseCase([
      buildUser({ roles: [{ id: 'role-1', name: 'Recepción', permissionKeys: ['carwash.read'] }] }),
    ]);

    expectRejection(await captureError(useCase.execute(CREDENTIALS, [VOID])));
  });

  it('rejects a user with no roles at all', async () => {
    const useCase = buildUseCase([buildUser({ roles: [] })]);

    expectRejection(await captureError(useCase.execute(CREDENTIALS, [VOID])));
  });
});
