import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../common/prisma/prisma.service';
import type { UserDirectory } from '../application/ports/user-directory';

/** Los nombres de quien cobró o anuló un pago de renta (098). */
@Injectable()
export class PrismaUserDirectory implements UserDirectory {
  constructor(private readonly prisma: PrismaService) {}

  async namesOf(ids: readonly string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();

    const rows = await this.prisma.user.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, fullName: true },
    });

    return new Map(rows.map((row) => [row.id, row.fullName]));
  }
}
