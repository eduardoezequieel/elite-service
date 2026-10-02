import type { EmployeesQuery, Page } from '@elite/shared';

import { slicePage } from '../../../../common/pagination/page';
import type { Employee } from '../../domain/employee';
import type {
  EmployeeChanges,
  EmployeeRepository,
  NewEmployeeData,
  UnfinishedWash,
} from '../ports/employee.repository';

/** Repositorio en memoria para los tests. Mismo contrato que el de Prisma. */
export class InMemoryEmployeeRepository implements EmployeeRepository {
  private readonly rows = new Map<string, Employee>();
  private sequence = 0;

  constructor(seed: Employee[] = []) {
    for (const employee of seed) this.rows.set(employee.id, employee);
  }

  async findAll(): Promise<Employee[]> {
    return [...this.rows.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  async findPage(filter: EmployeesQuery): Promise<Page<Employee>> {
    const search = filter.search?.toLowerCase() ?? '';
    const rows = (await this.findAll()).filter(
      (employee) =>
        (filter.active === undefined || employee.isActive === filter.active) &&
        (search === '' ||
          employee.fullName.toLowerCase().includes(search) ||
          employee.username.toLowerCase().includes(search)),
    );

    return slicePage(rows, filter);
  }

  async findById(id: string): Promise<Employee | null> {
    return this.rows.get(id) ?? null;
  }

  async findByPinHash(pinHash: string): Promise<Employee | null> {
    return [...this.rows.values()].find((row) => row.pinHash === pinHash) ?? null;
  }

  async existsByUsername(username: string, exceptId?: string): Promise<boolean> {
    return [...this.rows.values()].some((row) => row.username === username && row.id !== exceptId);
  }

  async existsByPinHash(pinHash: string, exceptId?: string): Promise<boolean> {
    return [...this.rows.values()].some((row) => row.pinHash === pinHash && row.id !== exceptId);
  }

  async create(data: NewEmployeeData): Promise<Employee> {
    const now = new Date();
    const employee: Employee = {
      id: `employee-${++this.sequence}`,
      username: data.username,
      fullName: data.fullName,
      pinHash: data.pinHash,
      isActive: true,
      pinChangedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    this.rows.set(employee.id, employee);

    return employee;
  }

  async update(id: string, changes: EmployeeChanges): Promise<Employee> {
    const current = this.rows.get(id);

    if (current === undefined) throw new Error(`No existe el empleado ${id}`);

    const updated: Employee = { ...current, ...changes, updatedAt: new Date() };

    this.rows.set(id, updated);

    return updated;
  }

  /** Lavados sin terminar por empleado. El test los siembra (090). */
  readonly unfinished = new Map<string, UnfinishedWash[]>();

  async listUnfinishedWashes(employeeId: string): Promise<UnfinishedWash[]> {
    return this.unfinished.get(employeeId) ?? [];
  }
}
