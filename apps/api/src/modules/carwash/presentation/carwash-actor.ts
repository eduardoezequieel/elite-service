import type { CarwashEventActor } from '@elite/shared';

import type {
  AuthenticatedEmployee,
  AuthenticatedUser,
} from '../../../common/auth/authenticated-user';

/**
 * Quien hizo la mutacion, en el formato que viaja por el stream (042).
 *
 * Sale de la sesion que el guard ya resolvio, nunca del cuerpo del request: si
 * el cliente pudiera decir quien fue, el «esto no lo hiciste vos» de la otra
 * pantalla dejaria de significar nada.
 */
export function userActor(user: AuthenticatedUser): CarwashEventActor {
  return { kind: 'user', id: user.id, name: user.fullName };
}

export function employeeActor(employee: AuthenticatedEmployee): CarwashEventActor {
  return { kind: 'employee', id: employee.id, name: employee.fullName };
}
