import { API_ERROR_CODES } from '@elite/shared';
import type { FloorLoginInput, FloorSessionResponse } from '@elite/shared';
import { UnauthorizedException } from '@nestjs/common';

import { canUseFloor } from '../domain/employee';
import type { FloorTokenIssuer, IssuedFloorToken } from './ports/floor-token-issuer';
import type { EmployeeRepository } from './ports/employee.repository';
import type { PinHasher } from './ports/pin.hasher';

/** Lo que necesita el controller: a quien mostrar y que cookie escribir. */
export interface FloorLoginResult {
  session: FloorSessionResponse;
  token: IssuedFloorToken;
}

/**
 * `POST /floor/login`. Publico.
 *
 * Usuario y PIN, no correo y contrasena: quien entra es un `Employee`, no un
 * `User` (RN-0). Usuario inexistente, PIN equivocado y empleado desactivado
 * responden lo mismo, con el mismo mensaje: no se le dice a quien prueba cual
 * de las tres fallo.
 *
 * El PIN se verifica **siempre**, incluso cuando el usuario no existe, contra
 * un hash de descarte. Si no, el tiempo de respuesta delata que usuarios
 * existen: bcrypt tarda ~100ms y no hacerlo devuelve en microsegundos.
 */
export class FloorLoginUseCase {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly pins: PinHasher,
    private readonly tokens: FloorTokenIssuer,
  ) {}

  /**
   * Hash de un PIN que no le sirve a nadie. Existe solo para gastar el mismo
   * tiempo cuando el usuario no existe.
   */
  private static readonly DECOY_HASH =
    '$2b$12$C6UzMDM.H6dfI/f/IKcEeODocmZ.rSHcMPQOFbxHTjaPZ0BSFhGm2';

  async execute(input: FloorLoginInput): Promise<FloorLoginResult> {
    const employee = await this.employees.findByUsername(input.username);
    const hash = employee?.pinHash ?? FloorLoginUseCase.DECOY_HASH;
    const pinMatches = await this.pins.verify(input.pin, hash);

    if (employee === null || !pinMatches || !canUseFloor(employee)) {
      throw new UnauthorizedException({
        code: API_ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Usuario o PIN incorrectos.',
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
