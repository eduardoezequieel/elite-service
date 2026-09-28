import { API_ERROR_CODES } from '@elite/shared';
import type { PublicEmployee, UpdateEmployeeInput } from '@elite/shared';

import { ConflictError, NotFoundError } from '../../../common/errors/application-error';
import type { EmployeeChanges, EmployeeRepository } from './ports/employee.repository';
import type { PinDigest } from './ports/pin-digest';
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
    private readonly pins: PinDigest,
  ) {}

  async execute(id: string, input: UpdateEmployeeInput): Promise<PublicEmployee> {
    const employee = await this.employees.findById(id);

    if (employee === null) {
      throw new NotFoundError({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese empleado no existe.',
      });
    }

    if (input.isActive === false && employee.isActive) {
      await this.rejectUnfinishedWashes(id, employee.fullName);
    }

    if (
      input.username !== undefined &&
      (await this.employees.existsByUsername(input.username, id))
    ) {
      throw new ConflictError({
        code: API_ERROR_CODES.USERNAME_TAKEN,
        message: 'Ya hay un empleado con ese usuario.',
      });
    }

    const pinHash = input.pin === undefined ? undefined : this.pins.digest(input.pin);

    if (pinHash !== undefined && (await this.employees.existsByPinHash(pinHash, id))) {
      throw new ConflictError({
        code: API_ERROR_CODES.PIN_TAKEN,
        message: 'Ese PIN ya lo usa otro empleado.',
      });
    }

    const changes: EmployeeChanges = {};

    if (input.fullName !== undefined) changes.fullName = input.fullName;
    if (input.username !== undefined) changes.username = input.username;
    if (input.isActive !== undefined) changes.isActive = input.isActive;

    if (pinHash !== undefined) {
      changes.pinHash = pinHash;
      // Las dos cosas se mueven juntas o no se mueve ninguna: reemplazar el PIN
      // sin correr la marca dejaria vivas las sesiones que debia cerrar (RN-18).
      changes.pinChangedAt = new Date();
    }

    return toPublicEmployee(await this.employees.update(id, changes));
  }

  /**
   * Desactivado no entra a la pista: sus lavados en cola o en curso quedarian
   * a nombre de alguien que no puede terminarlos (090). No se mueven solos: lo
   * decide oficina.
   */
  private async rejectUnfinishedWashes(id: string, fullName: string): Promise<void> {
    const washes = await this.employees.listUnfinishedWashes(id);

    if (washes.length === 0) return;

    const one = washes.length === 1;
    const count = one ? 'un lavado' : `${washes.length} lavados`;
    const plates = washes.map((wash) => wash.plate).join(', ');
    const hint = one ? 'Pasalo a otro o marcalo listo' : 'Pasalos a otro o marcalos listos';

    throw new ConflictError({
      code: API_ERROR_CODES.EMPLOYEE_HAS_ACTIVE_TICKETS,
      message: `${fullName} tiene ${count} sin terminar: ${plates}. ${hint} antes de desactivarlo.`,
      details: {
        tickets: washes.map((wash) => ({
          ticketId: wash.id,
          number: wash.number,
          plate: wash.plate,
          status: wash.status,
        })),
      },
    });
  }
}
