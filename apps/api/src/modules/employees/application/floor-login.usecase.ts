import { API_ERROR_CODES } from '@elite/shared';
import type { FloorLoginInput, FloorSessionResponse } from '@elite/shared';
import { UnauthorizedException } from '@nestjs/common';

import { canUseFloor } from '../domain/employee';
import type { FloorTokenIssuer, IssuedFloorToken } from './ports/floor-token-issuer';
import type { EmployeeRepository } from './ports/employee.repository';
import type { PinDigest } from './ports/pin-digest';

/** Lo que necesita el controller: a quien mostrar y que cookie escribir. */
export interface FloorLoginResult {
  session: FloorSessionResponse;
  token: IssuedFloorToken;
}

/**
 * `POST /floor/login`. Publico.
 *
 * Solo PIN, sin usuario y sin correo: quien entra es un `Employee`, no un
 * `User` (RN-0), y su PIN es unico en todo el taller (044 RN-1, RN-3). El PIN
 * no identifica ademas de autenticar: identifica **porque** autentica.
 *
 * PIN inexistente y empleado desactivado responden lo mismo, con el mismo
 * mensaje: la respuesta nunca dice de quien es un PIN ni si existe (044 RN-7).
 * Tampoco hace falta el hash de descarte de la 003: los dos caminos cuestan una
 * sola consulta por indice, asi que el tiempo no delata nada.
 */
export class FloorLoginUseCase {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly pins: PinDigest,
    private readonly tokens: FloorTokenIssuer,
  ) {}

  async execute(input: FloorLoginInput): Promise<FloorLoginResult> {
    const employee = await this.employees.findByPinHash(this.pins.digest(input.pin));

    if (employee === null || !canUseFloor(employee)) {
      throw new UnauthorizedException({
        code: API_ERROR_CODES.INVALID_CREDENTIALS,
        message: 'PIN incorrecto.',
      });
    }

    return {
      session: {
        employee: {
          id: employee.id,
          username: employee.username,
          fullName: employee.fullName,
        },
      },
      token: await this.tokens.issue(employee.id),
    };
  }
}
