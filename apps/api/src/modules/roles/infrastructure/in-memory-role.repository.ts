import { randomUUID } from 'node:crypto';

import { isSameRoleName, normalizePermissionKeys, type Role } from '../domain/role';
import type {
  CreateRoleData,
  RoleRepository,
  UpdateRoleData,
} from '../application/ports/role.repository';

/**
 * Implementacion en memoria del puerto `RoleRepository`.
 *
 * Es el doble que se inyecta en los `*.spec.ts` de los casos de uso: sin base
 * de datos y sin red. Copia la semantica de la implementacion con Prisma
 * (nombre unico sin distinguir mayusculas, `permissionKeys` reemplaza el
 * conjunto completo, `undefined` significa "no lo toques").
 */
export class InMemoryRoleRepository implements RoleRepository {
  private readonly roles = new Map<string, Role>();

  constructor(initialRoles: readonly Role[] = []) {
    for (const role of initialRoles) {
      this.roles.set(role.id, { ...role, permissionKeys: [...role.permissionKeys] });
    }
  }

  findAll(): Promise<Role[]> {
    const roles = [...this.roles.values()].sort((left, right) =>
      left.name.localeCompare(right.name),
    );

    return Promise.resolve(roles.map((role) => ({ ...role })));
  }

  findById(id: string): Promise<Role | null> {
    const role = this.roles.get(id);

    return Promise.resolve(role === undefined ? null : { ...role });
  }

  findByName(name: string): Promise<Role | null> {
    const role = [...this.roles.values()].find((candidate) =>
      isSameRoleName(candidate.name, name),
    );

    return Promise.resolve(role === undefined ? null : { ...role });
  }

  findPermissionKeysByRoleIds(roleIds: readonly string[]): Promise<string[]> {
    const keys = roleIds.flatMap((roleId) => this.roles.get(roleId)?.permissionKeys ?? []);

    return Promise.resolve(normalizePermissionKeys(keys));
  }

  create(data: CreateRoleData): Promise<Role> {
    const now = new Date();
    const role: Role = {
      id: randomUUID(),
      name: data.name,
      description: data.description,
      permissionKeys: normalizePermissionKeys(data.permissionKeys),
      userCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.roles.set(role.id, role);

    return Promise.resolve({ ...role });
  }

  update(id: string, data: UpdateRoleData): Promise<Role> {
    const current = this.roles.get(id);

    if (current === undefined) {
      return Promise.reject(new Error(`No existe el rol ${id}`));
    }

    const updated: Role = {
      ...current,
      name: data.name ?? current.name,
      description: data.description === undefined ? current.description : data.description,
      permissionKeys:
        data.permissionKeys === undefined
          ? current.permissionKeys
          : normalizePermissionKeys(data.permissionKeys),
      updatedAt: new Date(),
    };

    this.roles.set(id, updated);

    return Promise.resolve({ ...updated });
  }

  deleteById(id: string): Promise<void> {
    this.roles.delete(id);

    return Promise.resolve();
  }
}

/** Arma un rol de prueba con valores por defecto razonables. */
export function buildRole(overrides: Partial<Role> & Pick<Role, 'id' | 'name'>): Role {
  return {
    description: null,
    permissionKeys: [],
    userCount: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}
