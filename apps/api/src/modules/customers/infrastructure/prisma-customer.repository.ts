import type { Customer, Page, PageQuery } from '@elite/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { pageOf, skipTake } from '../../../common/pagination/page';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type {
  CustomerChanges,
  CustomerFilter,
  CustomerRepository,
  NewCustomerData,
} from '../application/ports/customer.repository';

const SELECT = { id: true, fullName: true, phone: true } as const;

@Injectable()
export class PrismaCustomerRepository implements CustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async search(filter: CustomerFilter = {}): Promise<Customer[]> {
    return this.prisma.customer.findMany({
      where: whereOf(filter),
      orderBy: { fullName: 'asc' },
      select: SELECT,
    });
  }

  async searchPage(filter: CustomerFilter, page: PageQuery): Promise<Page<Customer>> {
    const where = whereOf(filter);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
        select: SELECT,
        ...skipTake(page),
      }),
      this.prisma.customer.count({ where }),
    ]);

    return pageOf(rows, total, page);
  }

  async findById(id: string): Promise<Customer | null> {
    return this.prisma.customer.findUnique({ where: { id }, select: SELECT });
  }

  async create(data: NewCustomerData): Promise<Customer> {
    return this.prisma.customer.create({ data, select: SELECT });
  }

  async update(id: string, changes: CustomerChanges): Promise<Customer> {
    return this.prisma.customer.update({ where: { id }, data: changes, select: SELECT });
  }
}

/** Texto libre sobre nombre (sin mayusculas) o telefono. */
function whereOf(filter: CustomerFilter): Prisma.CustomerWhereInput {
  const trimmed = filter.query?.trim();

  if (trimmed === undefined || trimmed === '') return {};

  return {
    OR: [
      { fullName: { contains: trimmed, mode: 'insensitive' } },
      { phone: { contains: trimmed } },
    ],
  };
}
