/**
 * Puerto de consulta de roles.
 *
 * Este módulo asigna roles y necesita dos cosas de ellos: saber si existen y
 * saber qué permisos otorgan. Nada más: crear, editar y borrar roles es del
 * módulo `roles`. Se declara acá como puerto propio para no acoplar los casos
 * de uso de usuarios a la implementación de otro módulo.
 */
export interface RoleDirectory {
  /** De los ids pedidos, cuáles existen realmente. */
  findExistingIds(roleIds: readonly string[]): Promise<string[]>;
  /**
   * Unión de las claves `module.action` de esos roles, sin repetir (RN-3).
   * Se resuelve contra la base en el momento, no contra una copia congelada
   * (RN-6b).
   */
  findPermissionKeys(roleIds: readonly string[]): Promise<string[]>;
}
