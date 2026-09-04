import { API_ERROR_CODES } from '@elite/shared';
import type { CreateEmployeeInput, PublicEmployee } from '@elite/shared';
import { ConflictException } from '@nestjs/common';

import type { EmployeeRepository } from './ports/employee.repository';
import type { PinHasher } from './ports/pin.hasher';
import { toPublicEmployee } from './public-employee.mapper';

/** `POST /employees`. Requiere `employees.manage`. */
export class CreateEmployeeUseCase {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly pins: PinHasher,
  ) {}

  async execute(input: CreateEmployeeInput): Promise<PublicEmployee> {
    if (await this.employees.existsByUsername(input.username)) {
      throw new ConflictException({
        code: API_ERROR_CODES.USERNAME_TAKEN,
        message: 'Ya hay un empleado con ese usuario.',
      });
    }

    const created = await this.employees.create({
      username: input.username,
      fullName: input.fullName,
      // El PIN se hashea aca y no vuelve a salir nunca (RN-18).
      pinHash: await this.pins.hash(input.pin),
    });

    return toPublicEmployee(created);
  }
}
