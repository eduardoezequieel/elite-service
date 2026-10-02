import type { BankAccount, BankAccountsQuery, Page } from '@elite/shared';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { pageOf, skipTake } from '../../../common/pagination/page';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type {
  BankAccountChanges,
  BankAccountRepository,
  NewBankAccountData,
} from '../application/ports/bank-account.repository';
import { BankAccountDuplicateError } from '../domain/bank-account';
import { toBankAccount } from './bank-account-row';

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

@Injectable()
export class PrismaBankAccountRepository implements BankAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPage(filter: BankAccountsQuery): Promise<Page<BankAccount>> {
    const where: Prisma.BankAccountWhereInput =
      filter.active === undefined ? {} : { active: filter.active };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.bankAccount.findMany({
        where,
        orderBy: [{ bank: 'asc' }, { number: 'asc' }, { id: 'asc' }],
        ...skipTake(filter),
      }),
      this.prisma.bankAccount.count({ where }),
    ]);

    return pageOf(rows.map(toBankAccount), total, filter);
  }

  async findById(id: string): Promise<BankAccount | null> {
    const row = await this.prisma.bankAccount.findUnique({ where: { id } });

    return row === null ? null : toBankAccount(row);
  }

  async existsByBankAndNumber(bank: string, number: string, exceptId?: string): Promise<boolean> {
    const count = await this.prisma.bankAccount.count({
      where: { bank, number, ...(exceptId === undefined ? {} : { id: { not: exceptId } }) },
    });

    return count > 0;
  }

  async create(data: NewBankAccountData): Promise<BankAccount> {
    try {
      return toBankAccount(await this.prisma.bankAccount.create({ data }));
    } catch (error) {
      if (isUniqueViolation(error)) throw new BankAccountDuplicateError();

      throw error;
    }
  }

  async update(id: string, changes: BankAccountChanges): Promise<BankAccount> {
    try {
      return toBankAccount(await this.prisma.bankAccount.update({ where: { id }, data: changes }));
    } catch (error) {
      if (isUniqueViolation(error)) throw new BankAccountDuplicateError();

      throw error;
    }
  }
}
