import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { normalizePermissionKeys, type Role } from '../domain/role';
import type {
  CreateRoleData,
  RoleRepository,
  UpdateRoleData,
} from '../application/ports/role.repository';

/**
 * Implementacion del puerto `RoleRepository` con Prisma.
 *
 * Es el UNICO archivo del modulo que conoce el ORM: los casos de uso solo ven
 * la interfaz de `application/ports/`.
 */

/** Lo que hace falta traer para armar un `Role` de dominio. */
const roleInclude = {
  permissions: { include: { permission: { select: { key: true } } } },
  _count: { select: { users: true } },
} satisfies Prisma.RoleInclude;

type RoleRow = Prisma.RoleGetPayload<{ include: typeof roleInclude }>;

function toDomain(row: RoleRow): Role {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    permissionKeys: normalizePermissionKeys(row.permissions.map((link) => link.permission.key)),
    userCount: row._count.users,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class PrismaRoleRepository implements RoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Role[]> {
    const rows = await this.prisma.role.findMany({
      include: roleInclude,
      orderBy: { name: 'asc' },
    });

    return rows.map(toDomain);
  }

  async findById(id: string): Promise<Role | null> {
    const row = await this.prisma.role.findUnique({ where: { id }, include: roleInclude });

    return row === null ? null : toDomain(row);
  }

  async findByName(name: string): Promise<Role | null> {
    const row = await this.prisma.role.findFirst({
      where: { name: { equals: name.trim(), mode: 'insensitive' } },
      include: roleInclude,
    });

    return row === null ? null : toDomain(row);
  }

  async findPermissionKeysByRoleIds(roleIds: readonly string[]): Promise<string[]> {
    if (roleIds.length === 0) {
      return [];
    }

    const rows = await this.prisma.rolePermission.findMany({
      where: { roleId: { in: [...roleIds] } },
      select: { permission: { select: { key: true } } },
    });

    return normalizePermissionKeys(rows.map((link) => link.permission.key));
  }

  async create(data: CreateRoleData): Promise<Role> {
    const row = await this.prisma.$transaction(async (tx) => {
      const permissionIds = await resolvePermissionIds(tx, data.permissionKeys);

      return tx.role.create({
        data: {
          name: data.name,
          description: data.description,
          permissions: { create: permissionIds.map((permissionId) => ({ permissionId })) },
        },
        include: roleInclude,
      });
    });

    return toDomain(row);
  }

  async update(id: string, data: UpdateRoleData): Promise<Role> {
    const row = await this.prisma.$transaction(async (tx) => {
      // Reemplazar los permisos no recrea el rol ni toca a sus usuarios (RN-6b).
      if (data.permissionKeys !== undefined) {
        const permissionIds = await resolvePermissionIds(tx, data.permissionKeys);

        await tx.rolePermission.deleteMany({ where: { roleId: id } });

        if (permissionIds.length > 0) {
          await tx.rolePermission.createMany({
            data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
          });
        }
      }

      return tx.role.update({
        where: { id },
        data: { name: data.name, description: data.description },
        include: roleInclude,
      });
    });

    return toDomain(row);
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.role.delete({ where: { id } });
  }
}

/**
 * Traduce claves `module.action` a los ids de la tabla de permisos. Las claves
 * ya vienen validadas contra el registro de `@elite/shared` (RN-2); si aun asi
 * falta alguna en la base, el catalogo sembrado quedo desactualizado.
 */
async function resolvePermissionIds(
  tx: Prisma.TransactionClient,
  keys: readonly string[],
): Promise<string[]> {
  if (keys.length === 0) {
    return [];
  }

  const rows = await tx.permission.findMany({
    where: { key: { in: [...keys] } },
    select: { id: true, key: true },
  });

  if (rows.length !== keys.length) {
    const found = new Set(rows.map((row) => row.key));
    const missing = keys.filter((key) => !found.has(key));

    throw new Error(
      `El catalogo de permisos de la base esta desactualizado: falta ${missing.join(', ')}. Corre el seed.`,
    );
  }

  return rows.map((row) => row.id);
}
