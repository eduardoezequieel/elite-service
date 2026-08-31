import type { PublicUser } from '@elite/shared';

import type { UserRepository } from './ports/user.repository';
import { toPublicUser } from './public-user.mapper';

/**
 * `GET /users`. Devuelve la colección completa: sin paginación en v1, el
 * volumen esperado son decenas de filas.
 *
 * Los usuarios desactivados también se listan: se desactivan, no se eliminan
 * (RN-4), y la tabla los muestra con su sello.
 */
export class ListUsersUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(): Promise<PublicUser[]> {
    const found = await this.users.findAll();

    return found.map(toPublicUser);
  }
}
