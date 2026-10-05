import type { TabHolder, TabHolderRef } from '@elite/shared';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../common/prisma/prisma.service';
import type { TabLookups } from '../application/ports/tab-lookups';

/** Las lecturas previas de las cuentas abiertas (105): titular, turno y cuenta bancaria. */
@Injectable()
export class PrismaTabLookups implements TabLookups {
  constructor(private readonly prisma: PrismaService) {}

  async findHolder(ref: TabHolderRef): Promise<TabHolder | null> {
    if (ref.kind === 'EMPLOYEE') {
      const employee = await this.prisma.employee.findFirst({
        where: { id: ref.id, isActive: true },
        select: { id: true, fullName: true },
      });

      return employee === null ? null : { kind: 'EMPLOYEE', ...employee };
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: ref.id },
      select: { id: true, fullName: true },
    });

    return customer === null ? null : { kind: 'CUSTOMER', ...customer };
  }

  async findOpenCashSessionId(): Promise<string | null> {
    const session = await this.prisma.cashSession.findFirst({
      where: { status: 'OPEN' },
      select: { id: true },
    });

    return session?.id ?? null;
  }

  async findActiveBankAccountIds(ids: readonly string[]): Promise<string[]> {
    if (ids.length === 0) return [];

    const rows = await this.prisma.bankAccount.findMany({
      where: { id: { in: [...ids] }, active: true },
      select: { id: true },
    });

    return rows.map((row) => row.id);
  }
}
