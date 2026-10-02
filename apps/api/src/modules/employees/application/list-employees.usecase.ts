import type { EmployeesQuery, Page, PublicEmployee } from '@elite/shared';

import type { EmployeeRepository } from './ports/employee.repository';
import { toPublicEmployee } from './public-employee.mapper';

/** `GET /employees`, de a una pagina (spec 102). Requiere `employees.read`. */
export class ListEmployeesUseCase {
  constructor(private readonly employees: EmployeeRepository) {}

  async execute(query: EmployeesQuery): Promise<Page<PublicEmployee>> {
    const page = await this.employees.findPage(query);

    return { ...page, items: page.items.map(toPublicEmployee) };
  }
}
