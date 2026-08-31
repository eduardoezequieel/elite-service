import type { CreateRoleInput, PermissionGroup, RoleDetail, UpdateRoleInput } from '@elite/shared';

import { apiFetch } from '@/lib/api';

/**
 * Llamadas al API de roles y del catalogo de permisos (spec 001 → UI →
 * `/settings/roles`).
 *
 * Sin paginacion en v1: las tres colecciones vienen completas. Nadie llama a
 * `fetch` fuera de aca: los componentes consumen estos endpoints a traves de
 * los hooks de TanStack Query de `features/roles/hooks/`.
 */

/** `GET /roles` — todos los roles con sus permisos y su cuenta de usuarios. */
export function listRoles(): Promise<RoleDetail[]> {
  return apiFetch<RoleDetail[]>('/roles');
}

/** `POST /roles` — un rol sin permisos tambien es valido (RN-6b). */
export function createRole(input: CreateRoleInput): Promise<RoleDetail> {
  return apiFetch<RoleDetail>('/roles', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * `PATCH /roles/:id`.
 *
 * Ojo con `permissionKeys`: **reemplaza el conjunto completo** de permisos del
 * rol, no agrega. Lo que no venga en la lista se quita.
 */
export function updateRole(id: string, input: UpdateRoleInput): Promise<RoleDetail> {
  return apiFetch<RoleDetail>(`/roles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/** `DELETE /roles/:id` — falla con `409 ROLE_IN_USE` si tiene usuarios (RN-6). */
export function deleteRole(id: string): Promise<void> {
  return apiFetch<void>(`/roles/${id}`, { method: 'DELETE' });
}

/** `GET /permissions` — el catalogo agrupado por modulo, que alimenta la matriz. */
export function listPermissions(): Promise<PermissionGroup[]> {
  return apiFetch<PermissionGroup[]>('/permissions');
}
