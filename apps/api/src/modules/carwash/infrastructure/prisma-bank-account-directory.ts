import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../common/prisma/prisma.service';
import type { BankAccountDirectory } from '../application/ports/bank-account-directory';

@Injectable()
export class PrismaBankAccountDirectory implements BankAccountDirectory {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveIds(ids: readonly string[]): Promise<string[]> {
    if (ids.length === 0) return [];

    const rows = await this.prisma.bankAccount.findMany({
      where: { id: { in: [...ids] }, active: true },
      select: { id: true },
    });

    return rows.map((row) => row.id);
  }
}
