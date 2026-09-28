import type { AuthUser } from '../../domain/auth-user';
import type { AuthUserRepository } from '../ports/auth-user.repository';

/** Repositorio en memoria para los tests. Mismo contrato que el de Prisma. */
export class InMemoryAuthUserRepository implements AuthUserRepository {
  private readonly rows = new Map<string, AuthUser>();

  constructor(seed: AuthUser[] = []) {
    for (const user of seed) this.rows.set(user.id, user);
  }

  async findByEmail(email: string): Promise<AuthUser | null> {
    return [...this.rows.values()].find((user) => user.email === email) ?? null;
  }

  async findById(id: string): Promise<AuthUser | null> {
    return this.rows.get(id) ?? null;
  }

  async updatePassword(id: string, passwordHash: string, passwordChangedAt: Date): Promise<void> {
    const current = this.rows.get(id);

    if (current === undefined) throw new Error(`No existe el usuario ${id}`);

    this.rows.set(id, { ...current, passwordHash, passwordChangedAt });
  }
}

const REFERENCE_DATE = new Date('2026-01-01T00:00:00.000Z');

/** Un usuario activo con un rol; cada test pisa lo que le importa. */
export function buildAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-1',
    email: 'ana@elite.local',
    fullName: 'Ana Ramírez',
    passwordHash: 'hashed:secreta123',
    isActive: true,
    passwordChangedAt: REFERENCE_DATE,
    roles: [{ id: 'role-1', name: 'Recepción', permissionKeys: ['users.read'] }],
    createdAt: REFERENCE_DATE,
    updatedAt: REFERENCE_DATE,
    ...overrides,
  };
}
