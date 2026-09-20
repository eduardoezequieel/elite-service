import { API_ERROR_CODES } from '@elite/shared';
import type { CreateEmployeeInput, PublicEmployee } from '@elite/shared';
import { ConflictException } from '@nestjs/common';

import type { EmployeeRepository } from './ports/employee.repository';
import type { PinDigest } from './ports/pin-digest';
import { toPublicEmployee } from './public-employee.mapper';

/** `POST /employees`. Requiere `employees.manage`. */
export class CreateEmployeeUseCase {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly pins: PinDigest,
  ) {}

  async execute(input: CreateEmployeeInput): Promise<PublicEmployee> {
    if (await this.employees.existsByUsername(input.username)) {
      throw new ConflictException({
        code: API_ERROR_CODES.USERNAME_TAKEN,
        message: 'Ya hay un empleado con ese usuario.',
      });
    }

    // El PIN es la unica credencial de la pista, asi que dos empleados no
    // pueden compartirlo. Se revisa contra activos y desactivados (044 RN-3);
    // si dos altas simultaneas pasan esta puerta, el indice unico de la base
    // corta la segunda.
    const pinHash = this.pins.digest(input.pin);

    if (await this.employees.existsByPinHash(pinHash)) {
      throw new ConflictException({
        code: API_ERROR_CODES.PIN_TAKEN,
        message: 'Ese PIN ya lo usa otro empleado.',
      });
    }

    const created = await this.employees.create({
      username: input.username,
      fullName: input.fullName,
      // El PIN se convierte aca y no vuelve a salir nunca (RN-18, 044 RN-8).
      pinHash,
    });

    return toPublicEmployee(created);
  }
}
