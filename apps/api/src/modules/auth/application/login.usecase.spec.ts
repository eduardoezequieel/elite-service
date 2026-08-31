import { API_ERROR_CODES } from '@elite/shared';
import { UnauthorizedException } from '@nestjs/common';

import type { AuthUser } from '../domain/auth-user';
import { LoginUseCase } from './login.usecase';
import type { AuthUserRepository } from './ports/auth-user.repository';
import type { PasswordHasher } from './ports/password-hasher';
import type { IssuedToken, TokenIssuer } from './ports/token-issuer';

/** Implementaciones en memoria de los puertos: sin base de datos y sin red. */

class InMemoryAuthUserRepository implements AuthUserRepository {
  constructor(private readonly users: AuthUser[]) {}

  findByEmail(email: string): Promise<AuthUser | null> {
    return Promise.resolve(this.users.find((user) => user.email === email) ?? null);
  }

  findById(id: string): Promise<AuthUser | null> {
    return Promise.resolve(this.users.find((user) => user.id === id) ?? null);
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

class FakeTokenIssuer implements TokenIssuer {
  issue(userId: string): Promise<IssuedToken> {
    return Promise.resolve({ token: `token:${userId}`, expiresInSeconds: 60 });
  }

  verify(): Promise<null> {
    return Promise.resolve(null);
  }
}

const REFERENCE_DATE = new Date('2026-01-01T00:00:00.000Z');

function buildUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-1',
    email: 'mecanico@elite.local',
    fullName: 'Ana Mecánica',
    passwordHash: 'hashed:secreta123',
    isActive: true,
    passwordChangedAt: REFERENCE_DATE,
    roles: [
      { id: 'role-1', name: 'Recepción', permissionKeys: ['users.read', 'roles.read'] },
      { id: 'role-2', name: 'Taller', permissionKeys: ['users.read', 'users.manage'] },
    ],
    createdAt: REFERENCE_DATE,
    updatedAt: REFERENCE_DATE,
    ...overrides,
  };
}

function buildUseCase(users: AuthUser[]): LoginUseCase {
  return new LoginUseCase(
    new InMemoryAuthUserRepository(users),
    new FakePasswordHasher(),
    new FakeTokenIssuer(),
  );
}

async function captureError(operation: Promise<unknown>): Promise<UnauthorizedException> {
  try {
    await operation;
  } catch (error: unknown) {
    return error as UnauthorizedException;
  }

  throw new Error('Se esperaba un error y no hubo ninguno.');
}

describe('LoginUseCase', () => {
  it('signs in an active user and returns the union of the permissions of all its roles', async () => {
    const useCase = buildUseCase([buildUser()]);

    const result = await useCase.execute({
      email: 'mecanico@elite.local',
      password: 'secreta123',
    });

    expect(result.token).toEqual({ token: 'token:user-1', expiresInSeconds: 60 });
    // Union sin repetidos (RN-3), nunca por nombre de rol (RN-1).
    expect(result.session.permissions).toEqual(['roles.read', 'users.manage', 'users.read']);
    expect(result.session.user).toEqual({
      id: 'user-1',
      email: 'mecanico@elite.local',
      fullName: 'Ana Mecánica',
      isActive: true,
      roles: [
        { id: 'role-1', name: 'Recepción' },
        { id: 'role-2', name: 'Taller' },
      ],
      createdAt: REFERENCE_DATE.toISOString(),
      updatedAt: REFERENCE_DATE.toISOString(),
    });
  });

  it('never leaks the password hash in the response (RN-7)', async () => {
    const useCase = buildUseCase([buildUser()]);

    const result = await useCase.execute({
      email: 'mecanico@elite.local',
      password: 'secreta123',
    });

    expect(JSON.stringify(result.session)).not.toContain('hashed:');
  });

  it('rejects a wrong password with 401 INVALID_CREDENTIALS', async () => {
    const useCase = buildUseCase([buildUser()]);

    const error = await captureError(
      useCase.execute({ email: 'mecanico@elite.local', password: 'otra-cosa' }),
    );

    expect(error).toBeInstanceOf(UnauthorizedException);
    expect(error.getStatus()).toBe(401);
    expect(error.getResponse()).toMatchObject({ code: API_ERROR_CODES.INVALID_CREDENTIALS });
  });

  it('answers an unknown email exactly like a wrong password', async () => {
    const useCase = buildUseCase([buildUser()]);

    const unknownEmail = await captureError(
      useCase.execute({ email: 'nadie@elite.local', password: 'secreta123' }),
    );
    const wrongPassword = await captureError(
      useCase.execute({ email: 'mecanico@elite.local', password: 'otra-cosa' }),
    );

    expect(unknownEmail.getResponse()).toEqual(wrongPassword.getResponse());
  });

  it('rejects an inactive user with the very same answer as bad credentials (RN-4)', async () => {
    const useCase = buildUseCase([buildUser({ isActive: false })]);

    const inactive = await captureError(
      useCase.execute({ email: 'mecanico@elite.local', password: 'secreta123' }),
    );
    const wrongPassword = await captureError(
      useCase.execute({ email: 'mecanico@elite.local', password: 'otra-cosa' }),
    );

    expect(inactive.getStatus()).toBe(401);
    // Mismo code y mismo mensaje: no se revela cual de los dos fallo.
    expect(inactive.getResponse()).toEqual(wrongPassword.getResponse());
  });
});
