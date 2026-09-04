import { API_ERROR_CODES } from '@elite/shared';
import { UnauthorizedException } from '@nestjs/common';

import type { AuthUser } from '../domain/auth-user';
import { ChangePasswordUseCase } from './change-password.usecase';
import type { AuthUserRepository } from './ports/auth-user.repository';
import type { PasswordHasher } from './ports/password-hasher';
import type { IssuedToken, TokenIssuer } from './ports/token-issuer';

class InMemoryAuthUserRepository implements AuthUserRepository {
  constructor(private readonly users: AuthUser[]) {}

  findByEmail(email: string): Promise<AuthUser | null> {
    return Promise.resolve(this.users.find((user) => user.email === email) ?? null);
  }

  findById(id: string): Promise<AuthUser | null> {
    return Promise.resolve(this.users.find((user) => user.id === id) ?? null);
  }

  updatePassword(id: string, passwordHash: string, passwordChangedAt: Date): Promise<void> {
    const user = this.users.find((entry) => entry.id === id);

    if (user === undefined) {
      return Promise.reject(new Error(`User ${id} not found.`));
    }

    user.passwordHash = passwordHash;
    user.passwordChangedAt = passwordChangedAt;

    return Promise.resolve();
  }
}

class FakePasswordHasher implements PasswordHasher {
  hash(plainPassword: string): Promise<string> {
    return Promise.resolve(`hashed:${plainPassword}`);
  }

  verify(plainPassword: string, passwordHash: string): Promise<boolean> {
    return Promise.resolve(passwordHash === `hashed:${plainPassword}`);
  }
}

class FakeTokenIssuer implements TokenIssuer {
  readonly issuedAt: Date[] = [];

  issue(userId: string): Promise<IssuedToken> {
    this.issuedAt.push(new Date());

    return Promise.resolve({
      token: `token:${userId}:${this.issuedAt.length}`,
      expiresInSeconds: 60,
    });
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
    roles: [{ id: 'role-1', name: 'Recepción', permissionKeys: ['users.read'] }],
    createdAt: REFERENCE_DATE,
    updatedAt: REFERENCE_DATE,
    ...overrides,
  };
}

function buildUseCase(users: AuthUser[]): {
  useCase: ChangePasswordUseCase;
  tokens: FakeTokenIssuer;
  users: AuthUser[];
} {
  const tokens = new FakeTokenIssuer();

  return {
    useCase: new ChangePasswordUseCase(
      new InMemoryAuthUserRepository(users),
      new FakePasswordHasher(),
      tokens,
    ),
    tokens,
    users,
  };
}

async function captureError(operation: Promise<unknown>): Promise<UnauthorizedException> {
  try {
    await operation;
  } catch (error: unknown) {
    return error as UnauthorizedException;
  }

  throw new Error('Se esperaba un error y no hubo ninguno.');
}

describe('ChangePasswordUseCase', () => {
  it('hashes the new password, moves passwordChangedAt and returns a fresh token', async () => {
    const user = buildUser();
    const { useCase, tokens } = buildUseCase([user]);
    const before = Date.now();

    const token = await useCase.execute('user-1', {
      currentPassword: 'secreta123',
      newPassword: 'nuevaClave1',
    });

    expect(token).toEqual({ token: 'token:user-1:1', expiresInSeconds: 60 });
    expect(user.passwordHash).toBe('hashed:nuevaClave1');
    expect(user.passwordChangedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(tokens.issuedAt[0]?.getTime()).toBeGreaterThanOrEqual(user.passwordChangedAt.getTime());
  });

  it('never leaks the password hash in the token result', async () => {
    const { useCase } = buildUseCase([buildUser()]);

    const token = await useCase.execute('user-1', {
      currentPassword: 'secreta123',
      newPassword: 'nuevaClave1',
    });

    expect(JSON.stringify(token)).not.toContain('hashed:');
  });

  it('rejects a wrong current password with 401 INVALID_CREDENTIALS', async () => {
    const user = buildUser();
    const { useCase } = buildUseCase([user]);

    const error = await captureError(
      useCase.execute('user-1', { currentPassword: 'otra-cosa', newPassword: 'nuevaClave1' }),
    );

    expect(error).toBeInstanceOf(UnauthorizedException);
    expect(error.getStatus()).toBe(401);
    expect(error.getResponse()).toEqual({
      code: API_ERROR_CODES.INVALID_CREDENTIALS,
      message: 'La contraseña actual no es correcta.',
    });
    expect(user.passwordHash).toBe('hashed:secreta123');
    expect(user.passwordChangedAt).toEqual(REFERENCE_DATE);
  });

  it('rejects a missing or inactive user with 401 UNAUTHORIZED', async () => {
    const missing = await captureError(
      buildUseCase([]).useCase.execute('user-1', {
        currentPassword: 'secreta123',
        newPassword: 'nuevaClave1',
      }),
    );
    const inactive = await captureError(
      buildUseCase([buildUser({ isActive: false })]).useCase.execute('user-1', {
        currentPassword: 'secreta123',
        newPassword: 'nuevaClave1',
      }),
    );

    expect(missing.getStatus()).toBe(401);
    expect(missing.getResponse()).toMatchObject({ code: API_ERROR_CODES.UNAUTHORIZED });
    expect(inactive.getResponse()).toEqual(missing.getResponse());
  });
});
