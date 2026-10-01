import type { CreateRenterInput, Renter, RentersQuery, UpdateRenterInput } from '@elite/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { civilColumn } from '../../../common/prisma/date-column';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { RenterRepository } from '../application/ports/renter.repository';
import { toRenter } from './renter-row';

/** Las dos fechas civiles pasan a `@db.Date`; lo demás va tal cual. */
function withDates<T extends UpdateRenterInput>(input: T) {
  const { licenseExpiresAt, birthDate, ...rest } = input;

  return {
    ...rest,
    licenseExpiresAt: civilColumn(licenseExpiresAt),
    birthDate: civilColumn(birthDate),
  };
}

@Injectable()
export class PrismaRenterRepository implements RenterRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: RentersQuery): Promise<Renter[]> {
    const term = query.q?.trim();
    const contains = (value: string) => ({ contains: value, mode: 'insensitive' as const });
    const where: Prisma.RentalCustomerWhereInput = {
      ...(query.blocked === undefined ? {} : { isBlocked: query.blocked }),
      ...(query.active === undefined ? {} : { isActive: query.active }),
      ...(term === undefined || term === ''
        ? {}
        : {
            OR: [
              { fullName: contains(term) },
              { documentId: contains(term) },
              { licenseNumber: contains(term) },
              { mobilePhone: contains(term) },
              { phone: contains(term) },
            ],
          }),
    };

    const rows = await this.prisma.rentalCustomer.findMany({ where, orderBy: { fullName: 'asc' } });

    return rows.map(toRenter);
  }

  async findById(id: string): Promise<Renter | null> {
    const row = await this.prisma.rentalCustomer.findUnique({ where: { id } });

    return row === null ? null : toRenter(row);
  }

  async create(data: CreateRenterInput): Promise<Renter> {
    const row = await this.prisma.rentalCustomer.create({
      data: withDates(data) satisfies Prisma.RentalCustomerUncheckedCreateInput,
    });

    return toRenter(row);
  }

  async createMany(data: readonly CreateRenterInput[]): Promise<number> {
    const result = await this.prisma.rentalCustomer.createMany({
      data: data.map((item) => withDates(item) satisfies Prisma.RentalCustomerCreateManyInput),
    });

    return result.count;
  }

  async update(id: string, changes: UpdateRenterInput): Promise<Renter> {
    const row = await this.prisma.rentalCustomer.update({
      where: { id },
      data: withDates(changes),
    });

    return toRenter(row);
  }
}
