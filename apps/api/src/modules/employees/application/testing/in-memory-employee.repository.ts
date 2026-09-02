import type { Employee } from '../../domain/employee';
import type {
  EmployeeChanges,
  EmployeeRepository,
  NewEmployeeData,
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

  async findById(id: string): Promise<Employee | null> {
    return this.rows.get(id) ?? null;
  }

  async findByUsername(username: string): Promise<Employee | null> {
    return [...this.rows.values()].find((row) => row.username === username) ?? null;
  }

  async existsByUsername(username: string, exceptId?: string): Promise<boolean> {
    return [...this.rows.values()].some(
      (row) => row.username === username && row.id !== exceptId,
    );
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
}
