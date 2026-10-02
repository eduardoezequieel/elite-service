import type { Page, PublicUser, UsersQuery } from '@elite/shared';

import type { UserRepository } from './ports/user.repository';
import { toPublicUser } from './public-user.mapper';

/**
 * `GET /users`, de a una página (spec 102).
 *
 * Los usuarios desactivados también se listan: se desactivan, no se eliminan
 * (RN-4), y la tabla los muestra con su sello.
 */
export class ListUsersUseCase {
  constructor(private readonly users: UserRepository) {}

  /** `excludeSelf` saca a `currentUserId` de la lista y del total. */
  async execute(query: UsersQuery, currentUserId?: string): Promise<Page<PublicUser>> {
    const { excludeSelf, ...filter } = query;
    const page = await this.users.findPage({
      ...filter,
      excludeId: excludeSelf === true ? currentUserId : undefined,
    });

    return { ...page, items: page.items.map(toPublicUser) };
  }
}
