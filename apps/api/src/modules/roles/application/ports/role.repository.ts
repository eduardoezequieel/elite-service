import type { Role } from '../../domain/role';

/**
 * Puerto de persistencia de roles.
 *
 * Los casos de uso dependen SOLO de esta interfaz: la implementacion con
 * Prisma vive en `infrastructure/` y se cablea en `roles.module.ts`. En los
 * tests entra `InMemoryRoleRepository`, sin base y sin red.
 */

/** Datos para crear un rol. `permissionKeys` puede venir vacio (RN-6b). */
export interface CreateRoleData {
  name: string;
  description: string | null;
  permissionKeys: string[];
}

/**
 * Datos para editar un rol. Un campo `undefined` significa "no lo toques".
 * `permissionKeys` REEMPLAZA el conjunto completo de permisos del rol, sin
 * recrearlo ni tocar a los usuarios que lo tengan (RN-6b).
 */
export interface UpdateRoleData {
  name?: string;
  description?: string | null;
  permissionKeys?: string[];
}

export interface RoleRepository {
  /** Todos los roles. Sin paginacion en v1: el volumen es de decenas de filas. */
  findAll(): Promise<Role[]>;

  findById(id: string): Promise<Role | null>;

  /** Busca por nombre sin distinguir mayusculas: el nombre es unico. */
  findByName(name: string): Promise<Role | null>;

  /** Union de los permisos de los roles indicados (RN-3). */
  findPermissionKeysByRoleIds(roleIds: readonly string[]): Promise<string[]>;

  create(data: CreateRoleData): Promise<Role>;

  update(id: string, data: UpdateRoleData): Promise<Role>;

  deleteById(id: string): Promise<void>;
}

/** Token de inyeccion del puerto. La implementacion se elige en el modulo. */
export const ROLE_REPOSITORY = Symbol('RoleRepository');
