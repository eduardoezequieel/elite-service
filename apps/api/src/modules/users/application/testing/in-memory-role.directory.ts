import type { RoleDirectory } from '../ports/role.directory';

/**
 * Implementación en memoria del puerto de roles, para los tests.
 *
 * Se construye con un mapa `roleId -> claves de permiso`. Un rol que no está en
 * el mapa sencillamente no existe, que es justo lo que dispara
 * `422 INVALID_ROLE`.
 */
export class InMemoryRoleDirectory implements RoleDirectory {
  constructor(private readonly rolePermissions: ReadonlyMap<string, readonly string[]>) {}

  findExistingIds(roleIds: readonly string[]): Promise<string[]> {
    return Promise.resolve(roleIds.filter((roleId) => this.rolePermissions.has(roleId)));
  }

  findPermissionKeys(roleIds: readonly string[]): Promise<string[]> {
    const keys = new Set<string>();

    for (const roleId of roleIds) {
      for (const key of this.rolePermissions.get(roleId) ?? []) {
        keys.add(key);
      }
    }

    return Promise.resolve([...keys]);
  }
}
