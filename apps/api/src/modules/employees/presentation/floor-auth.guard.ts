import { API_ERROR_CODES } from '@elite/shared';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { FLOOR_SESSION_KEY, IS_PUBLIC_KEY } from '../../../common/auth/auth.decorators';
import {
  FLOOR_SESSION_COOKIE_NAME,
  REQUEST_EMPLOYEE_KEY,
} from '../../../common/auth/authenticated-user';
import { isTokenIssuedBeforePasswordChange } from '../../auth/domain/session';
import { EMPLOYEE_REPOSITORY } from '../application/ports/employee.repository';
import type { EmployeeRepository } from '../application/ports/employee.repository';
import { FLOOR_TOKEN_ISSUER } from '../application/ports/floor-token-issuer';
import type { FloorTokenIssuer } from '../application/ports/floor-token-issuer';
import { canUseFloor } from '../domain/employee';

/** Un solo mensaje para todos los motivos: no se le explica al atacante. */
const SESSION_INVALID_MESSAGE = 'Tu sesión no es válida. Iniciá sesión de nuevo.';

/**
 * Guard de la vista pista. Global, igual que el de oficina, pero solo actua
 * sobre las rutas marcadas con `@FloorSession()`.
 *
 * Hace lo mismo que su gemelo de oficina y por las mismas razones: lee la
 * cookie de pista, verifica el token —que debe declararse `kind: "employee"`—,
 * carga al empleado y aplica las dos reglas por request, que son RN-13
 * (desactivado pierde sus sesiones) y RN-18 (PIN reemplazado las invalida).
 *
 * La regla de "token anterior al cambio de credencial" se reutiliza tal cual de
 * 001: es la misma logica, con `pinChangedAt` en lugar de `passwordChangedAt`.
 */
@Injectable()
export class FloorAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(FLOOR_TOKEN_ISSUER) private readonly tokens: FloorTokenIssuer,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = [context.getHandler(), context.getClass()];

    // Solo atiende la pista. Todo lo demas es problema del guard de oficina.
    if (this.reflector.getAllAndOverride<boolean>(FLOOR_SESSION_KEY, handler) !== true) {
      return true;
    }

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, handler) === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const cookies = (request as Request & { cookies?: Record<string, string> }).cookies;
    const token = cookies?.[FLOOR_SESSION_COOKIE_NAME];

    if (token === undefined || token === '') throw unauthorized();

    const payload = await this.tokens.verify(token);

    if (payload === null) throw unauthorized();

    const employee = await this.employees.findById(payload.sub);

    // RN-13: un empleado desactivado pierde sus sesiones abiertas.
    if (employee === null || !canUseFloor(employee)) throw unauthorized();

    // RN-18: todo token emitido antes del ultimo cambio de PIN se rechaza.
    if (isTokenIssuedBeforePasswordChange(payload.iat, employee.pinChangedAt, payload.iatMs)) {
      throw unauthorized();
    }

    const bag = request as unknown as Record<string, unknown>;

    bag[REQUEST_EMPLOYEE_KEY] = {
      id: employee.id,
      username: employee.username,
      fullName: employee.fullName,
    };

    return true;
  }
}

function unauthorized(): UnauthorizedException {
  return new UnauthorizedException({
    code: API_ERROR_CODES.UNAUTHORIZED,
    message: SESSION_INVALID_MESSAGE,
  });
}
