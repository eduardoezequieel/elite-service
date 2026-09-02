import type { Customer } from '@elite/shared';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../common/prisma/prisma.service';
import type {
  CustomerChanges,
  CustomerRepository,
  NewCustomerData,
} from '../application/ports/customer.repository';

const SELECT = { id: true, fullName: true, phone: true, isActive: true } as const;

@Injectable()
export class PrismaCustomerRepository implements CustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async search(query?: string): Promise<Customer[]> {
    const trimmed = query?.trim();

    return this.prisma.customer.findMany({
      where:
        trimmed === undefined || trimmed === ''
          ? {}
          : {
              OR: [
                { fullName: { contains: trimmed, mode: 'insensitive' } },
                { phone: { contains: trimmed } },
              ],
            },
      orderBy: { fullName: 'asc' },
      select: SELECT,
    });
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
