/**
 * Capa `domain`: el rol y sus reglas puras. No importa NADA de afuera: ni
 * NestJS, ni Prisma, ni Zod. Todo lo de aca se puede probar sin base ni red.
 *
 * La regla que manda: un rol es un dato, nunca logica. Nadie decide nada
 * mirando su nombre; se decide por claves de permiso `module.action` (RN-1).
 */

/**
 * Clave que gobierna la administracion de roles. Se escribe aca como literal a
 * proposito: el dominio no importa el catalogo de `@elite/shared` para no
 * arrastrar dependencias. La capa de aplicacion valida contra ese catalogo.
 */
export const ROLES_MANAGE_PERMISSION = 'roles.manage';

/** Un rol con sus permisos y cuantos usuarios lo tienen asignado. */
export interface Role {
  id: string;
  name: string;
  description: string | null;
  /** Claves `module.action` del rol. Un rol sin permisos es valido (RN-6b). */
  permissionKeys: string[];
  /** Cuantos usuarios tienen este rol asignado. Manda sobre RN-6. */
  userCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** RN-6: un rol con usuarios asignados no se puede eliminar. */
export function isRoleInUse(role: Role): boolean {
  return role.userCount > 0;
}

/** Deja un conjunto de claves sin repetidos y en orden estable. */
export function normalizePermissionKeys(keys: readonly string[]): string[] {
  return [...new Set(keys)].sort((left, right) => left.localeCompare(right));
}

/** Los nombres de rol se comparan sin distinguir mayusculas ni espacios. */
export function isSameRoleName(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

/** Lo que hace falta para evaluar la puerta B del anti-lockout (RN-5). */
export interface SelfLockoutCheck {
  /** Ids de los roles que tiene el solicitante. */
  requesterRoleIds: readonly string[];
  /** Id del rol que se esta editando. */
  roleId: string;
  /** Permisos que el solicitante conserva por sus OTROS roles (RN-3). */
  permissionsFromOtherRoles: readonly string[];
  /** Conjunto de permisos que quedaria en el rol editado. */
  nextPermissionKeys: readonly string[];
}

/**
 * RN-5, puerta B: `true` si el cambio dejaria al propio solicitante sin
 * `roles.manage`.
 *
 * Se evalua sobre los permisos EFECTIVOS resultantes —la union de todos sus
 * roles despues del cambio—, nunca sobre nombres de rol. Si el solicitante no
 * tiene el rol que edita, no hay nada que evaluar.
 */
export function locksRequesterOut(check: SelfLockoutCheck): boolean {
  if (!check.requesterRoleIds.includes(check.roleId)) {
    return false;
  }

  const resultingPermissions = new Set<string>([
    ...check.permissionsFromOtherRoles,
    ...check.nextPermissionKeys,
  ]);

  return !resultingPermissions.has(ROLES_MANAGE_PERMISSION);
}
