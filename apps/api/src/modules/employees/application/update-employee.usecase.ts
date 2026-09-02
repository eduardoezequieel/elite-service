import { API_ERROR_CODES } from '@elite/shared';
import type { PublicEmployee, UpdateEmployeeInput } from '@elite/shared';
import { ConflictException, NotFoundException } from '@nestjs/common';

import type { EmployeeChanges, EmployeeRepository } from './ports/employee.repository';
import type { PinHasher } from './ports/pin.hasher';
import { toPublicEmployee } from './public-employee.mapper';

/**
 * `PATCH /employees/:id`. Requiere `employees.manage`.
 *
 * No hay `DELETE`: un empleado se desactiva, nunca se elimina (RN-13). Tiene
 * tickets colgando y borrarlo perderia de quien fue el trabajo.
 */
export class UpdateEmployeeUseCase {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly pins: PinHasher,
  ) {}

  async execute(id: string, input: UpdateEmployeeInput): Promise<PublicEmployee> {
    const employee = await this.employees.findById(id);

    if (employee === null) {
      throw new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese empleado no existe.',
      });
    }

    if (
      input.username !== undefined &&
      (await this.employees.existsByUsername(input.username, id))
    ) {
      throw new ConflictException({
        code: API_ERROR_CODES.USERNAME_TAKEN,
        message: 'Ya hay un empleado con ese usuario.',
      });
    }

    const changes: EmployeeChanges = {};

    if (input.fullName !== undefined) changes.fullName = input.fullName;
    if (input.username !== undefined) changes.username = input.username;
    if (input.isActive !== undefined) changes.isActive = input.isActive;

    if (input.pin !== undefined) {
      changes.pinHash = await this.pins.hash(input.pin);
      // Las dos cosas se mueven juntas o no se mueve ninguna: reemplazar el PIN
      // sin correr la marca dejaria vivas las sesiones que debia cerrar (RN-18).
      changes.pinChangedAt = new Date();
    }

    return toPublicEmployee(await this.employees.update(id, changes));
  }
}
