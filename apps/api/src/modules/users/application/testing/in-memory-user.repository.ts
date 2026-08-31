import type { User } from '../../domain/user';
import type { NewUserData, UserChanges, UserRepository } from '../ports/user.repository';

/**
 * Implementación en memoria del puerto de usuarios, para los tests: sin base de
 * datos y sin red (AGENTS.md, convención 4).
 *
 * Guarda el hash y la marca de cambio de contraseña aparte, porque la entidad
 * de dominio no los expone; los tests los leen con los métodos `*Of` para
 * verificar RN-7 y RN-10.
 */
export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();
  private readonly passwordHashes = new Map<string, string>();
  private readonly passwordChanges = new Map<string, Date>();
  private sequence = 0;

  constructor(seed: readonly User[] = []) {
    for (const user of seed) {
      this.users.set(user.id, { ...user, roles: [...user.roles] });
    }
  }

  findAll(): Promise<User[]> {
    return Promise.resolve([...this.users.values()]);
  }

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.users.get(id) ?? null);
  }

  existsByEmail(email: string): Promise<boolean> {
    const taken = [...this.users.values()].some((user) => user.email === email);

    return Promise.resolve(taken);
  }

  create(data: NewUserData): Promise<User> {
    this.sequence += 1;

    const now = new Date('2026-01-01T00:00:00.000Z');
    const user: User = {
      id: `user-${this.sequence}`,
      email: data.email,
      fullName: data.fullName,
      isActive: true,
      roles: data.roleIds.map((roleId) => ({ id: roleId, name: `Role ${roleId}` })),
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(user.id, user);
    this.passwordHashes.set(user.id, data.passwordHash);

    return Promise.resolve(user);
  }

  update(id: string, changes: UserChanges): Promise<User> {
    const current = this.users.get(id);

    if (current === undefined) {
      return Promise.reject(new Error(`Unknown user: ${id}`));
    }

    const updated: User = {
      ...current,
      fullName: changes.fullName ?? current.fullName,
      isActive: changes.isActive ?? current.isActive,
      roles:
        changes.roleIds === undefined
          ? current.roles
          : changes.roleIds.map((roleId) => ({ id: roleId, name: `Role ${roleId}` })),
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    };

    this.users.set(id, updated);

    if (changes.passwordHash !== undefined) {
      this.passwordHashes.set(id, changes.passwordHash);
    }

    if (changes.passwordChangedAt !== undefined) {
      this.passwordChanges.set(id, changes.passwordChangedAt);
    }

    return Promise.resolve(updated);
  }

  /** Sólo para los tests: el hash guardado, que el dominio nunca expone. */
  passwordHashOf(id: string): string | undefined {
    return this.passwordHashes.get(id);
  }

  /** Sólo para los tests: la marca que invalida las sesiones abiertas (RN-10). */
  passwordChangedAtOf(id: string): Date | undefined {
    return this.passwordChanges.get(id);
  }
}
