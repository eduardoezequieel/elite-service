import { API_ERROR_CODES } from '@elite/shared';

import { captureApiError } from '../../users/application/testing/capture-api-error';
import { GetSessionUseCase } from './get-session.usecase';
import { InMemoryAuthUserRepository, buildAuthUser } from './testing/in-memory-auth-user.repository';

describe('GetSessionUseCase', () => {
  it('devuelve el usuario, sus roles y sus permisos sin el hash', async () => {
    const users = new InMemoryAuthUserRepository([buildAuthUser()]);

    const session = await new GetSessionUseCase(users).execute('user-1');

    expect(session).toEqual({
      user: {
        id: 'user-1',
        email: 'ana@elite.local',
        fullName: 'Ana Ramírez',
        isActive: true,
        roles: [{ id: 'role-1', name: 'Recepción' }],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      roles: [{ id: 'role-1', name: 'Recepción' }],
      permissions: ['users.read'],
    });
    expect(JSON.stringify(session)).not.toContain('hashed:');
  });

  it('une los permisos de todos los roles, sin repetir y ordenados (RN-3)', async () => {
    const users = new InMemoryAuthUserRepository([
      buildAuthUser({
        roles: [
          { id: 'role-1', name: 'Caja', permissionKeys: ['carwash.charge', 'carwash.read'] },
          { id: 'role-2', name: 'Oficina', permissionKeys: ['carwash.read', 'users.read'] },
        ],
      }),
    ]);

    const session = await new GetSessionUseCase(users).execute('user-1');

    expect(session.permissions).toEqual(['carwash.charge', 'carwash.read', 'users.read']);
    expect(session.roles.map((role) => role.id)).toEqual(['role-1', 'role-2']);
  });

  /**
   * Una clave que sigue en la base pero ya salió del catálogo no llega a la
   * web: el contrato solo habla de `PermissionKey`.
   */
  it('descarta las claves que no están en el catálogo', async () => {
    const users = new InMemoryAuthUserRepository([
      buildAuthUser({
        roles: [{ id: 'role-1', name: 'Viejo', permissionKeys: ['legacy.export', 'users.read'] }],
      }),
    ]);

    const session = await new GetSessionUseCase(users).execute('user-1');

    expect(session.permissions).toEqual(['users.read']);
  });

  it('un usuario sin roles tiene sesión, pero sin permisos', async () => {
    const users = new InMemoryAuthUserRepository([buildAuthUser({ roles: [] })]);

    const session = await new GetSessionUseCase(users).execute('user-1');

    expect(session.roles).toEqual([]);
    expect(session.permissions).toEqual([]);
  });

  it('401 UNAUTHORIZED si el usuario ya no existe', async () => {
    const users = new InMemoryAuthUserRepository();

    const failure = await captureApiError(new GetSessionUseCase(users).execute('user-1'));

    expect(failure.status).toBe(401);
    expect(failure.body.code).toBe(API_ERROR_CODES.UNAUTHORIZED);
  });

  it('401 UNAUTHORIZED si el usuario está desactivado (RN-4)', async () => {
    const users = new InMemoryAuthUserRepository([buildAuthUser({ isActive: false })]);

    const failure = await captureApiError(new GetSessionUseCase(users).execute('user-1'));

    expect(failure.status).toBe(401);
    expect(failure.body.code).toBe(API_ERROR_CODES.UNAUTHORIZED);
  });
});
