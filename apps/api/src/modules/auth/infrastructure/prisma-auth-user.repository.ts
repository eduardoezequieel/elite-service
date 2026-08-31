import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import type { AuthUserRepository } from '../application/ports/auth-user.repository';
import type { AuthUser } from '../domain/auth-user';

/**
 * Implementacion del puerto con Prisma. Es el UNICO archivo del modulo que
 * conoce el ORM.
 *
 * Trae al usuario con sus roles y los permisos de cada rol en una sola
 * consulta: es la consulta por request que RN-6c declara como costo aceptado.
 */
const USER_WITH_PERMISSIONS = {
  roles: {
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  },
} as const satisfies Prisma.UserInclude;

type UserRow = Prisma.UserGetPayload<{ include: typeof USER_WITH_PERMISSIONS }>;

@Injectable()
export class PrismaAuthUserRepository implements AuthUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<AuthUser | null> {
    const row = await this.prisma.user.findUnique({
      where: { email },
      include: USER_WITH_PERMISSIONS,
    });

    return row === null ? null : toAuthUser(row);
  }

  async findById(id: string): Promise<AuthUser | null> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      include: USER_WITH_PERMISSIONS,
    });

    return row === null ? null : toAuthUser(row);
  }
}

/** Traduce la fila de Prisma a la entidad de dominio. */
function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    passwordHash: row.passwordHash,
    isActive: row.isActive,
    passwordChangedAt: row.passwordChangedAt,
    roles: row.roles.map((assignment) => ({
      id: assignment.role.id,
      name: assignment.role.name,
      permissionKeys: assignment.role.permissions.map((granted) => granted.permission.key),
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
