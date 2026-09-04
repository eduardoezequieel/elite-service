import type { PublicEmployee } from '@elite/shared';

import type { EmployeeRepository } from './ports/employee.repository';
import { toPublicEmployee } from './public-employee.mapper';

/** `GET /employees`. Requiere `employees.read` (lo exige el controller). */
export class ListEmployeesUseCase {
  constructor(private readonly employees: EmployeeRepository) {}

  async execute(): Promise<PublicEmployee[]> {
    return (await this.employees.findAll()).map(toPublicEmployee);
  }
}
