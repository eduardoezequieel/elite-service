import { MAX_PAGE_SIZE } from '@elite/shared';
import type { CreateUserInput, Page, PublicUser, RoleDetail, UpdateUserInput } from '@elite/shared';

import { listQuery } from '@/features/inventory/list-query';
import { apiFetch } from '@/lib/api';

/**
 * Llamadas al API de usuarios (spec 001 → UI → `/settings/users`). Las listas
 * vienen de a una página (spec 102).
 */

export interface UsersParams {
  /** Nombre o correo. */
  search?: string;
  /** `true` solo activos, `false` solo inactivos, sin él todos. */
  active?: boolean;
  roleId?: string;
  /** Saca de la lista a quien pregunta: la pantalla no se muestra a sí mismo. */
  excludeSelf?: boolean;
  page?: number;
  pageSize?: number;
}

/** `GET /users` — requiere `users.read`. */
export function listUsers(params: UsersParams = {}): Promise<Page<PublicUser>> {
  return apiFetch<Page<PublicUser>>(
    `/users${listQuery({
      search: params.search,
      active: params.active,
      roleId: params.roleId,
      excludeSelf: params.excludeSelf,
      page: params.page,
      pageSize: params.pageSize,
    })}`,
  );
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
export async function listAssignableRoles(): Promise<RoleDetail[]> {
  const page = await apiFetch<Page<RoleDetail>>(`/roles${listQuery({ pageSize: MAX_PAGE_SIZE })}`);

  return page.items;
}
