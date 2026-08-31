import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import type {
  NewUserData,
  UserChanges,
  UserRepository,
} from '../application/ports/user.repository';
import type { User } from '../domain/user';

/**
 * Selección única para todas las lecturas: `passwordHash` NO está acá, así que
 * el hash no puede salir del repositorio ni por descuido (RN-7).
 */
const userSelect = {
  id: true,
  email: true,
  fullName: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  roles: { select: { role: { select: { id: true, name: true } } } },
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof userSelect }>;

/**
 * Implementación del puerto de usuarios con Prisma. Es el único lugar del
 * módulo que conoce el ORM: los casos de uso sólo ven la interfaz.
 */
@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<User[]> {
    const rows = await this.prisma.user.findMany({
      select: userSelect,
      orderBy: { fullName: 'asc' },
    });

    return rows.map(toDomain);
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id }, select: userSelect });

    return row === null ? null : toDomain(row);
  }

  async existsByEmail(email: string): Promise<boolean> {
    const found = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });

    return found !== null;
  }

  async create(data: NewUserData): Promise<User> {
    const row = await this.prisma.user.create({
      data: {
        email: data.email,
        fullName: data.fullName,
        passwordHash: data.passwordHash,
        roles: { create: data.roleIds.map((roleId) => ({ roleId })) },
      },
      select: userSelect,
    });

    return toDomain(row);
  }

  async update(id: string, changes: UserChanges): Promise<User> {
    const row = await this.prisma.user.update({
      where: { id },
      data: {
        fullName: changes.fullName,
        isActive: changes.isActive,
        passwordHash: changes.passwordHash,
        passwordChangedAt: changes.passwordChangedAt,
        // `roleIds` reemplaza la asignación completa; el anidado lo resuelve en
        // una sola operación atómica, sin dejar al usuario sin roles a medias.
        roles:
          changes.roleIds === undefined
            ? undefined
            : { deleteMany: {}, create: changes.roleIds.map((roleId) => ({ roleId })) },
      },
      select: userSelect,
    });

    return toDomain(row);
  }
}

function toDomain(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    isActive: row.isActive,
    roles: row.roles.map((assignment) => ({
      id: assignment.role.id,
      name: assignment.role.name,
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
