import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../common/prisma/prisma.service';
import type { RoleDirectory } from '../application/ports/role.directory';

/**
 * Implementación del puerto de roles con Prisma. Sólo lee: crear y editar roles
 * es del módulo `roles`.
 */
@Injectable()
export class PrismaRoleDirectory implements RoleDirectory {
  constructor(private readonly prisma: PrismaService) {}

  async findExistingIds(roleIds: readonly string[]): Promise<string[]> {
    if (roleIds.length === 0) {
      return [];
    }

    const rows = await this.prisma.role.findMany({
      where: { id: { in: [...roleIds] } },
      select: { id: true },
    });

    return rows.map((row) => row.id);
  }

  async findPermissionKeys(roleIds: readonly string[]): Promise<string[]> {
    if (roleIds.length === 0) {
      return [];
    }

    const rows = await this.prisma.rolePermission.findMany({
      where: { roleId: { in: [...roleIds] } },
      select: { permission: { select: { key: true } } },
      distinct: ['permissionId'],
    });

    return rows.map((row) => row.permission.key);
  }
}
