import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../common/prisma/prisma.service';
import type {
  EmployeeChanges,
  EmployeeRepository,
  NewEmployeeData,
} from '../application/ports/employee.repository';
import type { Employee } from '../domain/employee';

/** Implementacion del puerto con Prisma. Unico lugar del modulo que lo toca. */
@Injectable()
export class PrismaEmployeeRepository implements EmployeeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Employee[]> {
    return this.prisma.employee.findMany({ orderBy: { fullName: 'asc' } });
  }

  async findById(id: string): Promise<Employee | null> {
    return this.prisma.employee.findUnique({ where: { id } });
  }

  async findByUsername(username: string): Promise<Employee | null> {
    return this.prisma.employee.findUnique({ where: { username } });
  }

  async existsByUsername(username: string, exceptId?: string): Promise<boolean> {
    const found = await this.prisma.employee.findFirst({
      where: { username, ...(exceptId === undefined ? {} : { id: { not: exceptId } }) },
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
}
