import type { CreateUserInput, PublicUser, RoleDetail, UpdateUserInput } from '@elite/shared';

import { apiFetch } from '@/lib/api';

/**
 * Llamadas al API de usuarios (spec 001 → UI → `/settings/users`).
 *
 * No hay paginacion en v1: las colecciones vienen completas, porque el volumen
 * esperado es de decenas de filas.
 */

/** `GET /users` — requiere `users.read`. */
export function listUsers(): Promise<PublicUser[]> {
  return apiFetch<PublicUser[]>('/users');
}

/** `POST /users` — requiere `users.manage`. */
export function createUser(input: CreateUserInput): Promise<PublicUser> {
  return apiFetch<PublicUser>('/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** `PATCH /users/:id` — requiere `users.manage`. */
export function updateUser(id: string, input: UpdateUserInput): Promise<PublicUser> {
  return apiFetch<PublicUser>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/**
 * `GET /roles` — requiere `roles.read`, que es un permiso **distinto** al de
 * esta pantalla: se necesita solo para poder elegir roles en el dialogo.
 *
 * Vive aca y no en `features/roles` a proposito: el modulo de roles administra
 * roles, y esto es apenas el catalogo que el formulario de usuarios necesita
 * para llenar un selector. Quien tenga `users.manage` pero no `roles.read`
 * recibe un 403 y el dialogo se dibuja sin selector, no roto.
 */
export function listAssignableRoles(): Promise<RoleDetail[]> {
  return apiFetch<RoleDetail[]>('/roles');
}
