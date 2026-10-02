import type { EmployeesQuery, Page } from '@elite/shared';
import { Injectable } from '@nestjs/common';
import { WorkOrderStatus, type Prisma } from '@prisma/client';

import { pageOf, skipTake } from '../../../common/pagination/page';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type {
  EmployeeChanges,
  EmployeeRepository,
  NewEmployeeData,
  UnfinishedWash,
} from '../application/ports/employee.repository';
import type { Employee } from '../domain/employee';

/** Implementacion del puerto con Prisma. Unico lugar del modulo que lo toca. */
@Injectable()
export class PrismaEmployeeRepository implements EmployeeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Employee[]> {
    return this.prisma.employee.findMany({ orderBy: { fullName: 'asc' } });
  }

  async findPage(filter: EmployeesQuery): Promise<Page<Employee>> {
    const search = filter.search === undefined || filter.search === '' ? undefined : filter.search;
    const where: Prisma.EmployeeWhereInput = {
      ...(filter.active === undefined ? {} : { isActive: filter.active }),
      ...(search === undefined
        ? {}
        : {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { username: { contains: search, mode: 'insensitive' } },
            ],
          }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
        ...skipTake(filter),
      }),
      this.prisma.employee.count({ where }),
    ]);

    return pageOf(rows, total, filter);
  }

  async findById(id: string): Promise<Employee | null> {
    return this.prisma.employee.findUnique({ where: { id } });
  }

  async findByPinHash(pinHash: string): Promise<Employee | null> {
    return this.prisma.employee.findUnique({ where: { pinHash } });
  }

  async existsByUsername(username: string, exceptId?: string): Promise<boolean> {
    const found = await this.prisma.employee.findFirst({
      where: { username, ...(exceptId === undefined ? {} : { id: { not: exceptId } }) },
      select: { id: true },
    });

    return found !== null;
  }

  async existsByPinHash(pinHash: string, exceptId?: string): Promise<boolean> {
    const found = await this.prisma.employee.findFirst({
      where: { pinHash, ...(exceptId === undefined ? {} : { id: { not: exceptId } }) },
      select: { id: true },
    });

    return found !== null;
  }

  async create(data: NewEmployeeData): Promise<Employee> {
    return this.prisma.employee.create({ data });
  }

  async update(id: string, changes: EmployeeChanges): Promise<Employee> {
    return this.prisma.employee.update({ where: { id }, data: changes });
  }

  async listUnfinishedWashes(employeeId: string): Promise<UnfinishedWash[]> {
    const rows = await this.prisma.workOrder.findMany({
      where: {
        status: { in: [WorkOrderStatus.OPEN, WorkOrderStatus.WASHING] },
        assignments: { some: { employeeId } },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, number: true, status: true, vehicle: { select: { plate: true } } },
    });

    return rows.map((row) => ({
      id: row.id,
      number: row.number,
      plate: row.vehicle.plate,
      status: row.status === WorkOrderStatus.WASHING ? 'WASHING' : 'OPEN',
    }));
  }
}
