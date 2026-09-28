import type { BankAccount } from '@elite/shared';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

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

  async list(activeOnly: boolean): Promise<BankAccount[]> {
    const rows = await this.prisma.bankAccount.findMany({
      where: activeOnly ? { active: true } : {},
      orderBy: [{ bank: 'asc' }, { number: 'asc' }],
    });

    return rows.map(toBankAccount);
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
