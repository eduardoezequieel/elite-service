import type { Page, UsersQuery } from '@elite/shared';

import type { User } from '../../domain/user';

/**
 * Puerto de persistencia de usuarios. Los casos de uso lo reciben por
 * constructor como interfaz: en producción lo implementa Prisma
 * (`infrastructure/`), en los tests una implementación en memoria.
 */

/** Datos con los que nace un usuario. La contraseña entra ya hasheada (RN-7). */
export interface NewUserData {
  email: string;
  fullName: string;
  passwordHash: string;
  roleIds: string[];
}

/**
 * Cambios a aplicar sobre un usuario existente. Todo es opcional: lo que no
 * viene, no se toca. `roleIds` reemplaza la asignación completa de roles.
 */
export interface UserChanges {
  fullName?: string;
  passwordHash?: string;
  /**
   * Se mueve junto con la contraseña: todo JWT emitido antes de esta marca
   * queda inválido, así que reemplazarla cierra las sesiones abiertas (RN-10).
   */
  passwordChangedAt?: Date;
  roleIds?: string[];
  isActive?: boolean;
}

/** Los filtros de `GET /users` ya resueltos: `excludeSelf` llega como id. */
export type UserListFilter = Omit<UsersQuery, 'excludeSelf'> & { excludeId?: string };

export interface UserRepository {
  /**
   * Una página, por nombre y después por id (spec 102). `search` busca en
   * nombre o correo; `excludeId` deja fuera a esa persona (quien pregunta).
   */
  findPage(filter: UserListFilter): Promise<Page<User>>;
  findById(id: string): Promise<User | null>;
  /** El correo es único; llega ya normalizado en minúsculas por el schema Zod. */
  existsByEmail(email: string): Promise<boolean>;
  create(data: NewUserData): Promise<User>;
  update(id: string, changes: UserChanges): Promise<User>;
}
